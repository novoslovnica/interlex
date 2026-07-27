/**
 * Бэкфилл Lexeme.isCollocation для уже существующих многословных лексем.
 *
 * Эвристика (см. план /Users/georgecarpow/.claude/plans/unified-herding-lightning.md):
 * - Список известных предлогов берётся живьём из БД (pos='ADP', однословные) —
 *   не хардкодится, чтобы не разъезжаться с админкой предлогов.
 * - Для pos='VERB': если хвост (всё после первого слова) целиком состоит из
 *   se/sę и/или известных предлогов (включая варианты через "/", напр. "do/k")
 *   — это МЕХАНИЧЕСКИЙ случай (регулярно спрягаемая конструкция), isCollocation
 *   НЕ ставится — обрабатывается в lib/grammar/morphology/processors.ts
 *   (processVerb) сшивкой головы с неизменяемым хвостом.
 * - Всё остальное многословное (все NOUN/ADJ/ADV/CCONJ/... и идиоматические
 *   VERB вроде "byti ostrazny", "dati rabotu") → isCollocation = true.
 *
 * Идемпотентен: обновляет только строки с isCollocation=0, повторный запуск —
 * no-op. Ничего не удаляет, только выставляет флаг.
 */
import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.DATA_SQLITE_DB || path.resolve(process.cwd(), "interlex.db")

const db = new Database(DB_PATH)

const prepositionRows = db
    .prepare(`SELECT DISTINCT value FROM lexemes WHERE pos = 'ADP' AND value NOT LIKE '% %'`)
    .all() as { value: string }[]
const prepositions = new Set(prepositionRows.map((r) => r.value.toLowerCase()))
console.log(`Известных предлогов в БД: ${prepositions.size}`)

function isMechanicalVerbTail(tail: string[]): boolean {
    return tail.every((token) => {
        if (token === "se" || token === "sę") return true
        return token.split("/").every((alt) => prepositions.has(alt))
    })
}

const candidates = db
    .prepare(`SELECT id, value, pos FROM lexemes WHERE value LIKE '% %' AND isCollocation = 0`)
    .all() as { id: number; value: string; pos: string | null }[]

const toFlag: { id: number; value: string; pos: string | null }[] = []
const mechanicalSkipped: { id: number; value: string }[] = []

for (const row of candidates) {
    const tokens = (row.value ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean)
    const tail = tokens.slice(1)

    if (row.pos === "VERB" && tail.length > 0 && isMechanicalVerbTail(tail)) {
        mechanicalSkipped.push({ id: row.id, value: row.value })
        continue
    }

    toFlag.push(row)
}

const update = db.prepare(`UPDATE lexemes SET isCollocation = 1 WHERE id = ?`)
const applyAll = db.transaction((rows: typeof toFlag) => {
    for (const row of rows) update.run(row.id)
})
applyAll(toFlag)

console.log(`\nВсего многословных лексем без флага: ${candidates.length}`)
console.log(`Помечено isCollocation=true: ${toFlag.length}`)
console.log(`Пропущено как механический глагол (se/sę/предлог): ${mechanicalSkipped.length}`)

console.log("\n--- Помечено как коллокация (проверить вручную на ложные срабатывания через /admin/words) ---")
for (const row of toFlag) {
    console.log(`[${row.id}] ${row.pos ?? "?"} | ${row.value}`)
}

console.log("\n--- Пропущено как механический случай (glagol + se/sę/предлог, будет корректно спрягаться) ---")
for (const row of mechanicalSkipped) {
    console.log(`[${row.id}] ${row.value}`)
}

db.close()
console.log("\nDone.")
