// Раннер скриптов, меняющих базы. Прод - главный источник данных: словарь,
// auth и библиотеку на проде меняют только скрипты из scripts/db/manifest.ts,
// и каждая попытка пишется в реестр _applied_scripts той базы, которую скрипт
// меняет (scripts/db/lib/registry.ts). Запускать из корня репозитория; на
// проде - через `bash prod.sh ...`.
//
//   npx tsx scripts/db/run.ts status                 что применено, что ждёт
//   npx tsx scripts/db/run.ts migrate                все ждущие schema-миграции (релиз, служба стоит)
//   npx tsx scripts/db/run.ts run <path>             dry-run
//   npx tsx scripts/db/run.ts run <path> --apply     применить (нужен свежий dry-run той же версии)
//        [--again]    повторно применить уже применённый data/schema-скрипт
//        [--detach]   запустить в фоне, вывод - в logs/db-runs/ (для heavy на проде)
//        [-- <args>]  аргументы самому скрипту
//   npx tsx scripts/db/run.ts mark-applied <path>    отметить как применённый без запуска
//
// Базы берутся из DB_DIR (по умолчанию - текущий каталог). Раннер сам
// выставляет скрипту все переменные путей (SQLITE_DB, *_SQLITE_DB,
// *_DATABASE_URL), поэтому скрипт не может случайно открыть другой файл.

import Database from "better-sqlite3"
import { execSync, spawn } from "child_process"
import fs from "fs"
import path from "path"
import dotenv from "dotenv"
import { DB_FILES, MANIFEST, findEntry, isLegacyScript, schemaMigrations, type DbName, type ManifestEntry } from "./manifest"
import {
    backupFileName, checkApply, checksumDrift, ensureRegistry, fileChecksum, lastApplied,
    recordFinish, recordStart, rotateBackups, type RunMode,
} from "./lib/registry"

const ROOT = process.cwd()
if (!fs.existsSync(path.join(ROOT, "scripts/db/manifest.ts"))) {
    console.error("run from the repository root")
    process.exit(2)
}
const DB_DIR = path.resolve(process.env.DB_DIR || ROOT)
const LOG_DIR = path.join(ROOT, "logs/db-runs")
const LOCK_PATH = path.join(DB_DIR, ".db-run.lock")
const KEEP_BACKUPS = 5

function dbPath(db: DbName): string {
    return path.join(DB_DIR, DB_FILES[db])
}

function stamp(now = new Date()): string {
    return now.toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")
}

function gitCommit(): string | null {
    try { return execSync("git rev-parse HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() } catch { return null }
}

function openRegistry(db: DbName): Database.Database {
    const p = dbPath(db)
    if (!fs.existsSync(p)) throw new Error(`${p} does not exist`)
    const handle = new Database(p)
    handle.pragma("busy_timeout = 10000")
    ensureRegistry(handle)
    return handle
}

// --- lock: два запуска одновременно на одной машине не идут (реанализ корпуса
// рядом с другим писателем уже однажды убил трёхчасовой прогон - AGENTS.md).
function acquireLock(): () => void {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const fd = fs.openSync(LOCK_PATH, "wx")
            fs.writeSync(fd, String(process.pid))
            fs.closeSync(fd)
            return () => { try { fs.rmSync(LOCK_PATH) } catch { /* уже снят */ } }
        } catch {
            const pid = Number(fs.readFileSync(LOCK_PATH, "utf8"))
            let alive = false
            try { process.kill(pid, 0); alive = true } catch { alive = false }
            if (alive) throw new Error(`another run is in progress (pid ${pid}, ${LOCK_PATH})`)
            fs.rmSync(LOCK_PATH)
        }
    }
    throw new Error(`cannot take ${LOCK_PATH}`)
}

function childEnv(): NodeJS.ProcessEnv {
    // .env даёт остальные переменные приложения; пути к базам - только наши.
    const env: NodeJS.ProcessEnv = { ...dotenv.config({ path: path.join(ROOT, ".env"), processEnv: {}, quiet: true }).parsed, ...process.env }
    const file = (db: DbName) => `file:${dbPath(db)}`
    Object.assign(env, {
        SQLITE_DB: dbPath("interlex"),
        DATA_SQLITE_DB: dbPath("interlex"),
        AUTH_SQLITE_DB: dbPath("auth"),
        LIBRARY_SQLITE_DB: dbPath("library"),
        CORPUS_SQLITE_DB: dbPath("corpus"),
        CORPUS_DB: dbPath("corpus"),
        HISTORICAL_SQLITE_DB: dbPath("historical"),
        DATA_DATABASE_URL: file("interlex"),
        AUTH_DATABASE_URL: file("auth"),
        LIBRARY_DATABASE_URL: file("library"),
        CORPUS_DATABASE_URL: file("corpus"),
        HISTORICAL_DATABASE_URL: file("historical"),
    })
    return env
}

function runChild(scriptPath: string, args: string[], logPath: string): Promise<number> {
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    const log = fs.createWriteStream(logPath, { flags: "a" })
    log.write(`$ npx tsx ${scriptPath} ${args.join(" ")}\n# ${new Date().toISOString()} commit ${gitCommit() ?? "?"}\n\n`)
    return new Promise((resolve) => {
        const child = spawn("npx", ["tsx", scriptPath, ...args], { cwd: ROOT, env: childEnv(), stdio: ["inherit", "pipe", "pipe"] })
        child.stdout.on("data", (d) => { process.stdout.write(d); log.write(d) })
        child.stderr.on("data", (d) => { process.stderr.write(d); log.write(d) })
        child.on("close", (code, signal) => {
            const exit = code ?? (signal ? 128 : 1)
            log.end(`\n# exit ${exit}${signal ? ` (${signal})` : ""} ${new Date().toISOString()}\n`)
            resolve(exit)
        })
    })
}

async function backup(db: DbName, scriptPath: string): Promise<string> {
    const target = backupFileName(dbPath(db), scriptPath)
    const src = new Database(dbPath(db), { readonly: true })
    try { await src.backup(target) } finally { src.close() }
    for (const removed of rotateBackups(dbPath(db), KEEP_BACKUPS)) console.log(`    old backup removed: ${path.basename(removed)}`)
    return target
}

function requireEntry(scriptPath: string): ManifestEntry {
    const entry = findEntry(scriptPath)
    if (entry) return entry
    if (isLegacyScript(scriptPath)) throw new Error(`${scriptPath} is a legacy script (before the manifest) - it is already applied on production; add it to scripts/db/manifest.ts only if it really has to run again`)
    throw new Error(`${scriptPath} is not in scripts/db/manifest.ts`)
}

async function execute(entry: ManifestEntry, mode: RunMode, opts: { again: boolean; args: string[] }): Promise<number> {
    const scriptFile = path.join(ROOT, entry.path)
    if (!fs.existsSync(scriptFile)) throw new Error(`${entry.path} not found`)
    const checksum = fileChecksum(scriptFile)
    const registry = openRegistry(entry.db)
    try {
        if (mode === "apply") {
            const check = checkApply(registry, {
                name: entry.path, checksum, once: entry.kind !== "repeatable", requiresDryRun: entry.dryRun, again: opts.again,
            })
            if (!check.ok) { console.error(`refused: ${check.reason}`); return 2 }
        }
        if (mode === "dry-run" && !entry.dryRun) {
            console.error(`refused: ${entry.path} has no dry-run mode (manifest dryRun: false) - check it locally, then run with --apply`)
            return 2
        }
        let backupPath: string | null = null
        if (mode === "apply" && !entry.noBackup) {
            console.log(`==> backup ${DB_FILES[entry.db]}`)
            backupPath = await backup(entry.db, entry.path)
            console.log(`    ${backupPath}`)
        }
        const logPath = path.join(LOG_DIR, `${stamp()}-${mode}-${path.basename(entry.path).replace(/\.[^.]+$/, "")}.log`)
        const id = recordStart(registry, { name: entry.path, kind: entry.kind, checksum, gitCommit: gitCommit(), mode, logPath, backupPath })
        // Скрипт может писать в ту же базу долго - не держим своё соединение открытым.
        registry.close()
        console.log(`==> ${mode} ${entry.path} (${entry.db})\n`)
        const scriptArgs = [...opts.args, ...(mode === "apply" && entry.dryRun ? ["--apply"] : [])]
        const exit = await runChild(entry.path, scriptArgs, logPath)
        const after = openRegistry(entry.db)
        recordFinish(after, id, exit)
        after.close()
        console.log(`\n==> ${exit === 0 ? "OK" : `FAILED (exit ${exit})`}; log: ${path.relative(ROOT, logPath)}`)
        if (exit === 0 && mode === "dry-run") console.log(`    to apply: ${process.env.PROD_SH ? "bash prod.sh" : "npx tsx scripts/db/run.ts"} run ${entry.path} --apply`)
        if (exit === 0 && mode === "apply" && entry.needsRestart) console.log("    schema changed: npm run db:gen-* and restart the service")
        return exit
    } finally {
        if (registry.open) registry.close()
    }
}

/** Только чтение: status не должен ничего создавать на проде. Нет таблицы - ничего не применено. */
function readRegistry<T>(db: DbName, fn: (reg: Database.Database) => T, empty: T): T {
    const reg = new Database(dbPath(db), { readonly: true, fileMustExist: true })
    try {
        const exists = reg.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_applied_scripts'`).get()
        return exists ? fn(reg) : empty
    } finally { reg.close() }
}

function status(): void {
    const rows: string[] = []
    let pendingSchema = 0
    let pendingData = 0
    for (const entry of MANIFEST) {
        const file = path.join(ROOT, entry.path)
        if (!fs.existsSync(dbPath(entry.db))) { rows.push(`   ?  ${entry.path}  (${DB_FILES[entry.db]} missing)`); continue }
        const { applied, drift } = readRegistry(entry.db, (reg) => ({
            applied: lastApplied(reg, entry.path),
            drift: fs.existsSync(file) ? checksumDrift(reg, entry.path, fileChecksum(file)) : undefined,
        }), { applied: undefined, drift: undefined })
        if (!applied && entry.kind === "schema") pendingSchema++
        if (!applied && entry.kind === "data") pendingData++
        const mark = entry.kind === "repeatable" ? (applied ? "ran" : "   ") : applied ? " ok" : "WAIT"
        const when = applied ? `  last ${applied.mode} ${applied.startedAt.slice(0, 16)}` : ""
        rows.push(`${mark.padStart(4)}  [${entry.kind}] ${entry.path} -> ${entry.db}${when}${drift ? "  !! file changed since it was applied" : ""}${fs.existsSync(file) ? "" : "  !! file missing"}`)
    }
    console.log(`DB_DIR ${DB_DIR}\n`)
    console.log(rows.length ? rows.join("\n") : "manifest is empty")
    console.log(`\npending: ${pendingSchema} schema (applied by release), ${pendingData} data (run by hand)`)
}

async function migrate(): Promise<number> {
    const pending = schemaMigrations().filter((e) => {
        if (!fs.existsSync(dbPath(e.db))) { console.log(`skip ${e.path}: ${DB_FILES[e.db]} missing`); return false }
        const r = openRegistry(e.db); const a = lastApplied(r, e.path); r.close(); return !a
    })
    if (pending.length === 0) { console.log("no pending schema migrations"); return 0 }
    for (const e of pending) {
        const exit = await execute(e, "apply", { again: false, args: [] })
        if (exit !== 0) return exit
    }
    return 0
}

function markApplied(entry: ManifestEntry): number {
    const reg = openRegistry(entry.db)
    const id = recordStart(reg, { name: entry.path, kind: entry.kind, checksum: fileChecksum(path.join(ROOT, entry.path)), gitCommit: gitCommit(), mode: "baseline" })
    recordFinish(reg, id, 0)
    reg.close()
    console.log(`marked ${entry.path} as applied in ${DB_FILES[entry.db]}`)
    return 0
}

function detach(argv: string[]): number {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    const out = path.join(LOG_DIR, `${stamp()}-detached.out`)
    const fd = fs.openSync(out, "a")
    const child = spawn("npx", ["tsx", "scripts/db/run.ts", ...argv.filter((a) => a !== "--detach")], {
        cwd: ROOT, detached: true, stdio: ["ignore", fd, fd], env: process.env,
    })
    child.unref()
    console.log(`started in background, pid ${child.pid}\noutput: ${path.relative(ROOT, out)}`)
    return 0
}

async function main(): Promise<number> {
    const argv = process.argv.slice(2)
    const dashDash = argv.indexOf("--")
    const own = dashDash === -1 ? argv : argv.slice(0, dashDash)
    const scriptArgs = dashDash === -1 ? [] : argv.slice(dashDash + 1)
    const [command, target] = own.filter((a) => !a.startsWith("--"))
    const flag = (f: string) => own.includes(f)

    if (flag("--detach")) return detach(argv)

    switch (command) {
        case "status":
            status()
            return 0
        case "migrate": {
            const release = acquireLock()
            try { return await migrate() } finally { release() }
        }
        case "run": {
            if (!target) throw new Error("usage: run <script-path> [--apply] [--again] [-- args]")
            const entry = requireEntry(target)
            if (entry.kind === "schema" && !flag("--apply")) console.log("note: schema migrations are applied by `migrate` during a release")
            if (entry.heavy && !process.stdout.isTTY) console.warn("warning: heavy script without --detach - a dropped ssh connection will kill it")
            const release = acquireLock()
            try { return await execute(entry, flag("--apply") ? "apply" : "dry-run", { again: flag("--again"), args: scriptArgs }) } finally { release() }
        }
        case "mark-applied": {
            if (!target) throw new Error("usage: mark-applied <script-path>")
            return markApplied(requireEntry(target))
        }
        default:
            console.error("commands: status | migrate | run <path> [--apply] [--again] [--detach] [-- args] | mark-applied <path>")
            return 2
    }
}

main().then((code) => process.exit(code), (e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
})
