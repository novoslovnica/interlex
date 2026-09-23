// Реестр запусков скриптов по базам (_applied_scripts). Прод - главный
// источник данных, поэтому каждый скрипт, меняющий базу на проде, проходит
// через scripts/db/run.ts, а тот пишет сюда каждую попытку: dry-run, apply,
// baseline (отметка "уже применён вручную"). Таблица живёт в той базе, которую
// скрипт меняет - реестр переезжает вместе с файлом и не требует кросс-базовых
// запросов. Prisma её не моделирует (raw SQL, как все миграции проекта).

import type Database from "better-sqlite3"
import crypto from "crypto"
import fs from "fs"
import path from "path"

export type RunMode = "dry-run" | "apply" | "baseline"

export interface RunRow {
    id: number
    name: string
    kind: string
    checksum: string
    gitCommit: string | null
    mode: RunMode
    startedAt: string
    finishedAt: string | null
    exitCode: number | null
    backupPath: string | null
    logPath: string | null
}

/** Сколько живёт успешный dry-run, после которого разрешён --apply. */
export const DRY_RUN_VALID_MS = 24 * 60 * 60 * 1000

export function ensureRegistry(db: Database.Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "_applied_scripts" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "name" TEXT NOT NULL,
            "kind" TEXT NOT NULL,
            "checksum" TEXT NOT NULL,
            "gitCommit" TEXT,
            "mode" TEXT NOT NULL,
            "startedAt" TEXT NOT NULL,
            "finishedAt" TEXT,
            "exitCode" INTEGER,
            "backupPath" TEXT,
            "logPath" TEXT
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "_applied_scripts_name_idx" ON "_applied_scripts"("name", "startedAt")`)
}

export function fileChecksum(filePath: string): string {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

export function recordStart(
    db: Database.Database,
    row: { name: string; kind: string; checksum: string; gitCommit: string | null; mode: RunMode; logPath?: string | null; backupPath?: string | null },
    now: Date = new Date(),
): number {
    const info = db.prepare(`
        INSERT INTO _applied_scripts (name, kind, checksum, gitCommit, mode, startedAt, backupPath, logPath)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.name, row.kind, row.checksum, row.gitCommit, row.mode, now.toISOString(), row.backupPath ?? null, row.logPath ?? null)
    return Number(info.lastInsertRowid)
}

export function recordFinish(db: Database.Database, id: number, exitCode: number, now: Date = new Date()): void {
    db.prepare(`UPDATE _applied_scripts SET finishedAt = ?, exitCode = ? WHERE id = ?`).run(now.toISOString(), exitCode, id)
}

/** Последний успешный apply или baseline - "скрипт применён". */
export function lastApplied(db: Database.Database, name: string): RunRow | undefined {
    return db.prepare(`
        SELECT * FROM _applied_scripts
        WHERE name = ? AND mode IN ('apply', 'baseline') AND exitCode = 0
        ORDER BY id DESC LIMIT 1
    `).get(name) as RunRow | undefined
}

export function lastSuccessfulDryRun(db: Database.Database, name: string, checksum: string): RunRow | undefined {
    return db.prepare(`
        SELECT * FROM _applied_scripts
        WHERE name = ? AND checksum = ? AND mode = 'dry-run' AND exitCode = 0
        ORDER BY id DESC LIMIT 1
    `).get(name, checksum) as RunRow | undefined
}

export type ApplyCheck = { ok: true } | { ok: false; reason: string }

/**
 * Можно ли выполнить --apply. once-скрипт (схема или разовая правка данных)
 * повторно - только с again; repeatable (пересчёты) - сколько угодно.
 * Скрипту с поддержкой dry-run нужен успешный dry-run той же версии файла
 * не старше DRY_RUN_VALID_MS - иначе на проде применится то, что никто не видел.
 */
export function checkApply(
    db: Database.Database,
    opts: { name: string; checksum: string; once: boolean; requiresDryRun: boolean; again: boolean; now?: Date },
): ApplyCheck {
    const now = opts.now ?? new Date()
    if (opts.once && !opts.again) {
        const applied = lastApplied(db, opts.name)
        if (applied) return { ok: false, reason: `already applied (${applied.mode} ${applied.startedAt}); pass --again to run it once more` }
    }
    if (opts.requiresDryRun) {
        const dry = lastSuccessfulDryRun(db, opts.name, opts.checksum)
        if (!dry) return { ok: false, reason: "no successful dry run of this version of the script - run it without --apply first" }
        const age = now.getTime() - new Date(dry.startedAt).getTime()
        if (age > DRY_RUN_VALID_MS) return { ok: false, reason: `the last dry run is older than 24h (${dry.startedAt}) - run it again` }
    }
    return { ok: true }
}

/** Применённый скрипт, файл которого с тех пор изменился. */
export function checksumDrift(db: Database.Database, name: string, checksum: string): RunRow | undefined {
    const applied = lastApplied(db, name)
    return applied && applied.mode !== "baseline" && applied.checksum !== checksum ? applied : undefined
}

export function backupFileName(dbPath: string, scriptName: string, now: Date = new Date()): string {
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-")
    const base = path.basename(scriptName).replace(/\.[^.]+$/, "")
    return `${dbPath}.backup-before-run-${stamp}-${base}`
}

/** Оставляет keep самых новых бэкапов раннера для этой базы, остальные удаляет. */
export function rotateBackups(dbPath: string, keep: number): string[] {
    const dir = path.dirname(dbPath)
    const prefix = `${path.basename(dbPath)}.backup-before-run-`
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix)).sort()
    const removed = files.slice(0, Math.max(0, files.length - keep))
    for (const f of removed) fs.rmSync(path.join(dir, f))
    return removed
}
