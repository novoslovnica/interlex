// Бэкфилл CorpusToken.homonymGroupKey на уже размеченном корпусе — разовое
// заполнение для токенов, которые были разобраны до появления колонки
// (roadmap п.111, lib/corpus/homonymGroup.ts).
//
// Новые и переразмеченные токены получают ключ сами, на путях записи
// (reanalyzeDocument.persistUpdates, upsertDocument, app/api/corpus/save),
// поэтому повторный прогон нужен только после массового реанализа, который
// почему-то не проставил ключи, — и он безопасен (полностью детерминирован).
//
// Скрипт идёт мимо Prisma, только better-sqlite3: считает наборы лексем по
// кандидатам напрямую. Это самая дорогая часть (~2,5 минуты на живой базе,
// тот же GROUP BY, что и в scripts/db/measure-corpus-ambiguity.ts), поэтому
// он помечен к запуску с --detach.
//
// Контракт data-скрипта (AGENTS.md, "Production data changes"): без --apply
// ничего не пишет.
//
// Usage:
//   npx tsx scripts/db/2026-10-14-backfill-homonym-group-keys.ts            # dry run
//   npx tsx scripts/db/2026-10-14-backfill-homonym-group-keys.ts --apply
//
// Перед запуском должна быть применена DDL-миграция
// scripts/db/2026-10-14-add-corpus-homonym-group-key.ts.

import Database from "better-sqlite3"
import path from "path"
import { homonymGroupKey } from "@/lib/corpus/homonymGroup"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
const APPLY = process.argv.includes("--apply")

// Не одна гигантская транзакция: в верхних группах по 50–80 тыс. токенов, а
// всего ключей ~1,09 млн, и один такой commit раздувает WAL. Идемпотентность
// от разбиения не страдает.
const BATCH = 50_000

console.log(`Target DB: ${DB_PATH}`)
console.log(`Mode: ${APPLY ? "APPLY" : "dry run (ничего не пишется)"}\n`)

const db = new Database(DB_PATH, { readonly: !APPLY })

const columns = db.prepare(`PRAGMA table_info("CorpusToken")`).all() as { name: string }[]
if (!columns.some((c) => c.name === "homonymGroupKey")) {
    console.error("Нет колонки CorpusToken.homonymGroupKey — сначала примените scripts/db/2026-10-14-add-corpus-homonym-group-key.ts")
    db.close()
    process.exit(1)
}

const started = Date.now()
console.log("Считаю наборы лексем по кандидатам (GROUP BY по всем неоднозначным токенам)...")
db.exec(`
    CREATE TEMP TABLE hom_keys AS
    SELECT t."id" AS tokenId,
           t."surfaceForm" AS form,
           COUNT(DISTINCT c."wordSlug") AS lexemes,
           group_concat(DISTINCT c."wordSlug") AS slugs
    FROM "CorpusToken" t
    JOIN "CorpusTokenCandidate" c ON c."tokenId" = t."id"
    WHERE t."matchCount" > 1
      AND t."resolutionSource" = 'auto'
      AND t."isPartialMatch" = 0
      AND t."wordIndex" <> -1
    GROUP BY t."id"
`)
console.log(`Готово за ${((Date.now() - started) / 1000).toFixed(1)}s\n`)

const totals = db.prepare(`
    SELECT COUNT(*) AS ambiguous,
           SUM(CASE WHEN lexemes >= 2 THEN 1 ELSE 0 END) AS grouped
    FROM hom_keys
`).get() as { ambiguous: number; grouped: number }

console.log(`Неоднозначных токенов (>= 2 граммемы какой-либо лексемы): ${totals.ambiguous.toLocaleString("ru-RU")}`)
console.log(`Из них с конкуренцией РАЗНЫХ лексем (получат ключ):        ${Number(totals.grouped ?? 0).toLocaleString("ru-RU")}`)
console.log(`Спор только о граммеме одной лексемы (ключа не будет):     ${(totals.ambiguous - Number(totals.grouped ?? 0)).toLocaleString("ru-RU")}\n`)

const sample = db.prepare(`
    SELECT form, lexemes, COUNT(*) AS freq
    FROM hom_keys WHERE lexemes >= 2
    GROUP BY form ORDER BY freq DESC LIMIT 10
`).all() as { form: string; lexemes: number; freq: number }[]
console.log("Самые частые формы с конкуренцией разных лексем:")
for (const s of sample) {
    console.log(`  ${s.form.padEnd(14)} ${s.freq.toLocaleString("ru-RU")} токенов, ${s.lexemes} лексем`)
}
console.log()

if (!APPLY) {
    console.log("Dry run: ключи не записаны. Повторите с --apply.")
    db.close()
    process.exit(0)
}

// Полная перезапись: сначала снимаем старые ключи (в т.ч. у токенов, которые
// перестали быть неоднозначными), затем проставляем актуальные. Оба шага
// идемпотентны.
const clearStarted = Date.now()
const cleared = db.prepare(`UPDATE "CorpusToken" SET "homonymGroupKey" = NULL WHERE "homonymGroupKey" IS NOT NULL`).run().changes
console.log(`Снято старых ключей: ${cleared.toLocaleString("ru-RU")} (${((Date.now() - clearStarted) / 1000).toFixed(1)}s)`)

const selectRows = db.prepare(`SELECT rowid AS rid, tokenId, form, slugs FROM hom_keys WHERE lexemes >= 2 ORDER BY rowid LIMIT ?`)
const selectBatch = db.prepare(`SELECT rowid AS rid, tokenId, form, slugs FROM hom_keys WHERE lexemes >= 2 AND rowid > ? ORDER BY rowid LIMIT ?`)
const update = db.prepare(`UPDATE "CorpusToken" SET "homonymGroupKey" = ? WHERE "id" = ?`)

let written = 0
let skippedDegenerate = 0
const writeBatch = db.transaction((rows: { tokenId: number; key: string }[]) => {
    for (const r of rows) update.run(r.key, r.tokenId)
})

// Постранично, а не через .iterate(): better-sqlite3 запрещает открывать
// пишущую транзакцию, пока на том же соединении жив читающий курсор
// ("This database connection is busy executing a query"). .all() закрывает
// курсор до возврата, поэтому writeBatch проходит.
const writeStarted = Date.now()
let lastRid = 0
for (;;) {
    const batch = (lastRid === 0
        ? selectRows.all(BATCH)
        : selectBatch.all(lastRid, BATCH)) as { rid: number; tokenId: number; form: string; slugs: string }[]
    if (batch.length === 0) break
    lastRid = batch[batch.length - 1].rid

    const rows: { tokenId: number; key: string }[] = []
    for (const row of batch) {
        const slugs = row.slugs.split(",").filter((s) => s.length > 0)
        const key = homonymGroupKey(row.form, slugs)
        // COUNT(DISTINCT) >= 2, но после нормализации/дедупа осталось меньше
        // двух — теоретически возможно при пустых слагах; просто пропускаем.
        if (!key) {
            skippedDegenerate++
            continue
        }
        rows.push({ tokenId: row.tokenId, key })
    }
    if (rows.length > 0) {
        writeBatch(rows)
        written += rows.length
    }
    process.stdout.write(`\r  записано: ${written.toLocaleString("ru-RU")}`)
}
process.stdout.write(`\r  записано: ${written.toLocaleString("ru-RU")}\n`)
console.log(`Запись заняла ${((Date.now() - writeStarted) / 1000).toFixed(1)}s`)
if (skippedDegenerate > 0) console.log(`Пропущено из-за вырожденного набора слагов: ${skippedDegenerate}`)

const final = db.prepare(`
    SELECT COUNT(*) AS tokens, COUNT(DISTINCT "homonymGroupKey") AS groups
    FROM "CorpusToken" WHERE "homonymGroupKey" IS NOT NULL
`).get() as { tokens: number; groups: number }
console.log(`\nИтого с ключом: ${final.tokens.toLocaleString("ru-RU")} токенов в ${final.groups.toLocaleString("ru-RU")} группах.`)
console.log("Done.")
db.close()
