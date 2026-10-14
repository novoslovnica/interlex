// Нормализация value: value — ПОИСКОВЫЙ ключ и должен быть без диакритики,
// этимологическое написание живёт в stem и CORE-аллofone. Разово приводим
// существующие записи к этому правилу (вариант «б», подтверждён 2026-10-15):
// меняем и value, и слаг (slug = <value>-<POS>, занятый ключ -> -2, -3, как
// lib/slug.ts::generateUniqueSlug), перевязываем ссылки в corpus.db.
//
// Редиректы со старых слагов НЕ делаются — по решению мейнтейнера старые ссылки
// здесь не поддерживаются.
//
// Идемпотентна (повторный прогон не находит диакритики в value), пишет AuditLog
// (по строке на value и на slug), поддерживает dry-run.
//
// Usage:
//   npx tsx scripts/db/2026-10-15-normalize-value-diacritics.ts           # dry run
//   npx tsx scripts/db/2026-10-15-normalize-value-diacritics.ts --apply

import fs from "fs"
import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const CORPUS_PATH = process.env.CORPUS_SQLITE_DB || process.env.CORPUS_DB || path.resolve(process.cwd(), "corpus.db")
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:normalize-value-diacritics"
const HAS_DIACRITICS = /[^\x20-\x7E]/

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

interface Change { lex: Lex; newValue: string; newSlug: string }
const changes: Change[] = []
const skippedNoPos: string[] = []
const now = new Date().toISOString().replace("Z", "+00:00")

for (const l of all) {
    const value = l.value ?? ""
    if (!HAS_DIACRITICS.test(value)) continue
    const newValue = foldDiacritics(value.toLowerCase())
    if (newValue === value) continue
    if (!l.pos) { skippedNoPos.push(l.slug); continue }
    const base = `${newValue}-${l.pos.trim()}`
    let newSlug = base
    if (taken.has(newSlug)) {
        let n = 2
        while (taken.has(`${base}-${n}`)) n++
        newSlug = `${base}-${n}`
    }
    taken.delete(l.slug)
    taken.add(newSlug)
    changes.push({ lex: l, newValue, newSlug })
}

console.log(`Лексем с диакритикой в value: ${changes.length + skippedNoPos.length}`)
console.log(`К изменению: ${changes.length}; без POS (пропущено): ${skippedNoPos.length}`)
const withMarker = changes.filter((c) => /-\d+$/.test(c.newSlug))
console.log(`Получат числовой маркер: ${withMarker.length}`)
console.log("\nпримеры:")
for (const c of changes.slice(0, 10)) console.log(`  ${c.lex.slug} -> ${c.newSlug}   value "${c.lex.value}" -> "${c.newValue}"`)
if (skippedNoPos.length > 0) console.log(`\nбез POS: ${skippedNoPos.slice(0, 10).join(", ")}`)

if (!APPLY) {
    console.log("\nDry run only — re-run with --apply.")
    process.exit(0)
}

const backup = `${DB_PATH}.backup-before-value-normalization`
if (!fs.existsSync(backup)) { fs.copyFileSync(DB_PATH, backup); console.log(`\nbackup: ${backup}`) }

const run = db.transaction(() => {
    for (const c of changes) {
        db.prepare(`UPDATE lexemes SET value = ?, slug = ?, updatedAt = ? WHERE id = ?`).run(c.newValue, c.newSlug, now, c.lex.id)
        audit(c.lex.id, "value", c.lex.value, c.newValue)
        audit(c.lex.id, "slug", c.lex.slug, c.newSlug)
    }
})
run()
db.close()
console.log(`\ninterlex: ${changes.length} лексем нормализовано`)

// corpus.db: ссылки на переименованные слаги + устаревшие ключи групп.
const corpus = new Database(CORPUS_PATH)
corpus.pragma("foreign_keys = ON")
const froms = changes.map((c) => c.lex.slug)
const tos = changes.map((c) => c.newSlug)
const CHUNK = 400

const repoint = corpus.transaction(() => {
    let tokens = 0, candidates = 0, keysCleared = 0
    for (let i = 0; i < froms.length; i += CHUNK) {
        const f = froms.slice(i, i + CHUNK)
        const t = tos.slice(i, i + CHUNK)
        const marks = f.map(() => "?").join(",")
        corpus.prepare(`CREATE TEMP TABLE IF NOT EXISTS affected_tokens (tokenId INTEGER PRIMARY KEY)`)
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
