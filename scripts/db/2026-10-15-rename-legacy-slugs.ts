// Переименование слагов старого образца: слаг — ключ и должен быть
// <value>-<POS> (значение уже ASCII после нормализации value). Осталось 1 546
// лексем с диакритикой В СЛАГЕ при ASCII value — наследие старого именования
// (aleksěj-n, až-, adriatičesko morje-n). Приводим их к тому же правилу,
// коллизия -> -2, -3 (как lib/slug.ts::generateUniqueSlug), value НЕ трогаем.
//
// Отбор строго по не-ASCII в слаге, поэтому слаги с числовым маркером
// (lis-NOUN-2) не задеваются: у них слаг уже ASCII.
//
// Идемпотентна, пишет AuditLog (field='slug'), поддерживает dry-run; фаза
// corpus.db перевязывает ссылки и снимает устаревшие ключи групп омонимов.
//
// Usage:
//   npx tsx scripts/db/2026-10-15-rename-legacy-slugs.ts           # dry run
//   npx tsx scripts/db/2026-10-15-rename-legacy-slugs.ts --apply

import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const CORPUS_PATH = process.env.CORPUS_SQLITE_DB || process.env.CORPUS_DB || path.resolve(process.cwd(), "corpus.db")
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:rename-legacy-slugs"
const NON_ASCII = /[^\x20-\x7E]/

interface Lex { id: number; slug: string; value: string | null; pos: string | null }

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

console.log(`interlex: ${DB_PATH}`)
console.log(`corpus:   ${CORPUS_PATH}`)
console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`)

const all = db.prepare(`SELECT id, slug, value, pos FROM lexemes`).all() as Lex[]
const taken = new Set(all.map((l) => l.slug))

function audit(entityId: number, field: string, oldValue: unknown, newValue: unknown) {
    db.prepare(`INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt)
        VALUES (?, 'Lexeme', ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)`).run(
        randomUUID(), entityId, field,
        oldValue === null || oldValue === undefined ? null : String(oldValue),
        newValue === null || newValue === undefined ? null : String(newValue),
        AUTHOR,
    )
}

interface Change { lex: Lex; newSlug: string }
const changes: Change[] = []
const skipped: string[] = []
const now = new Date().toISOString().replace("Z", "+00:00")

for (const l of all) {
    if (!NON_ASCII.test(l.slug)) continue
    if (!l.pos) { skipped.push(`${l.slug} (нет POS)`); continue }
    const base = `${String(l.value ?? "").toLowerCase()}-${l.pos.trim()}`
    if (NON_ASCII.test(base)) { skipped.push(`${l.slug} (в value тоже диакритика)`); continue }
    let newSlug = base
    if (taken.has(newSlug)) {
        let n = 2
        while (taken.has(`${base}-${n}`)) n++
        newSlug = `${base}-${n}`
    }
    if (newSlug === l.slug) continue
    taken.delete(l.slug)
    taken.add(newSlug)
    changes.push({ lex: l, newSlug })
}

console.log(`Слагов старого образца (не-ASCII): ${changes.length + skipped.length}`)
console.log(`К переименованию: ${changes.length}; пропущено: ${skipped.length}`)
console.log(`Получат числовой маркер: ${changes.filter((c) => /-\d+$/.test(c.newSlug)).length}`)
console.log("\nпримеры:")
for (const c of changes.slice(0, 12)) console.log(`  ${c.lex.slug} -> ${c.newSlug}`)
if (skipped.length > 0) console.log(`\nпропущены: ${skipped.slice(0, 8).join("; ")}`)

if (!APPLY) {
    console.log("\nDry run only — re-run with --apply.")
    process.exit(0)
}

const backup = `${DB_PATH}.backup-before-legacy-slug-rename`
if (!fs.existsSync(backup)) { fs.copyFileSync(DB_PATH, backup); console.log(`\nbackup: ${backup}`) }

const run = db.transaction(() => {
    for (const c of changes) {
        db.prepare(`UPDATE lexemes SET slug = ?, updatedAt = ? WHERE id = ?`).run(c.newSlug, now, c.lex.id)
        audit(c.lex.id, "slug", c.lex.slug, c.newSlug)
    }
})
run()
console.log(`\ninterlex: ${changes.length} слагов переименовано`)

// Карта перенаправлений: при первом прогоне — из changes, при повторном (после
// сбоя в фазе corpus) — из аудита этого скрипта.
const redirectPairs: Array<[string, string]> = changes.length > 0
    ? changes.map((c) => [c.lex.slug, c.newSlug] as [string, string])
    : (db.prepare(`SELECT oldValue, newValue FROM audit_logs
        WHERE userEmail = ? AND entityType = 'Lexeme' AND field = 'slug'
          AND oldValue IS NOT NULL AND newValue IS NOT NULL`).all(AUTHOR) as { oldValue: string; newValue: string }[])
        .map((r) => [r.oldValue, r.newValue] as [string, string])
if (changes.length === 0) console.log(`Повторный прогон: карта из аудита, пар ${redirectPairs.length}`)
db.close()

const corpus = new Database(CORPUS_PATH)
corpus.pragma("foreign_keys = ON")
const froms = redirectPairs.map(([f]) => f)
const tos = redirectPairs.map(([, t]) => t)
const CHUNK = 400

const repoint = corpus.transaction(() => {
    let tokens = 0, candidates = 0, keysCleared = 0
    corpus.exec(`CREATE TEMP TABLE IF NOT EXISTS affected_tokens (tokenId INTEGER PRIMARY KEY)`)
    for (let i = 0; i < froms.length; i += CHUNK) {
        const f = froms.slice(i, i + CHUNK)
        const t = tos.slice(i, i + CHUNK)
        const marks = f.map(() => "?").join(",")
        corpus.prepare(`DELETE FROM affected_tokens`).run()
        corpus.prepare(`INSERT OR IGNORE INTO affected_tokens SELECT DISTINCT tokenId FROM CorpusTokenCandidate WHERE wordSlug IN (${marks})`).run(...f)
        keysCleared += corpus.prepare(`UPDATE CorpusToken SET homonymGroupKey = NULL
            WHERE homonymGroupKey IS NOT NULL AND id IN (SELECT tokenId FROM affected_tokens)`).run().changes
        const caseExpr = f.map(() => "WHEN ? THEN ?").join(" ")
        candidates += corpus.prepare(`UPDATE CorpusTokenCandidate SET wordSlug = CASE wordSlug ${caseExpr} ELSE wordSlug END
            WHERE wordSlug IN (${marks})`).run(...f.flatMap((x, k) => [x, t[k]]), ...f).changes
        for (let k = 0; k < f.length; k++) {
            tokens += corpus.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = CASE WHEN lemma = ? THEN ? ELSE lemma END WHERE wordSlug = ?`).run(t[k], f[k], t[k], f[k]).changes
            corpus.prepare(`UPDATE CorpusCandidateProposal SET siblingWordSlug = ? WHERE siblingWordSlug = ?`).run(t[k], f[k])
        }
    }
    corpus.prepare(`DROP TABLE IF EXISTS affected_tokens`).run()
    console.log(`corpus: ${tokens} токенов перенаправлено, ${candidates} кандидатов, ${keysCleared} ключей групп снято`)
})
repoint()
corpus.close()
