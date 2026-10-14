// CorpusToken.homonymGroupKey — ключ группы массовой разметки омонимов
// (roadmap п.111, lib/corpus/homonymGroup.ts) + индекс под GROUP BY очереди
// /admin/corpus/homonyms.
//
// corpus.db не ведёт _prisma_migrations, поэтому raw SQL, как и у остальных
// её таблиц (scripts/db/2026-09-15-add-corpus-fk-indexes.ts). Идемпотентен:
// колонка добавляется только если её ещё нет (SQLite не умеет
// "ADD COLUMN IF NOT EXISTS"), индекс — через IF NOT EXISTS.
//
// ALTER TABLE ADD COLUMN в SQLite — операция над метаданными, на 5-млн таблице
// мгновенная; CREATE INDEX читает всю таблицу и может занять минуты.
//
// Usage:
//   CORPUS_SQLITE_DB=/path/to/corpus.db npx tsx scripts/db/2026-10-14-add-corpus-homonym-group-key.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

type ColumnInfo = { name: string }
const columns = db.prepare(`PRAGMA table_info("CorpusToken")`).all() as ColumnInfo[]

if (columns.some((c) => c.name === "homonymGroupKey")) {
    console.log(`CorpusToken.homonymGroupKey уже есть — ALTER пропущен.`)
} else {
    const started = Date.now()
    db.exec(`ALTER TABLE "CorpusToken" ADD COLUMN "homonymGroupKey" TEXT`)
    console.log(`ALTER TABLE — ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

{
    const started = Date.now()
    // Составной индекс (ключ группы, документ) покрывает и GROUP BY по ключу,
    // и COUNT(DISTINCT documentSlug) — одиночный индекс по ключу заставлял
    // читать documentSlug из таблицы по случайным rowid (~5 c на рендер списка
    // верхних групп). Накрывает и префиксный поиск по одному ключу.
    db.exec(`DROP INDEX IF EXISTS "CorpusToken_homonymGroupKey_idx"`)
    db.exec(`CREATE INDEX IF NOT EXISTS "CorpusToken_homonymGroupKey_documentSlug_idx" ON "CorpusToken"("homonymGroupKey", "documentSlug")`)
    console.log(`CREATE INDEX — ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

const grouped = (db.prepare(`SELECT COUNT(*) c FROM "CorpusToken" WHERE "homonymGroupKey" IS NOT NULL`).get() as { c: number }).c
console.log(`\nТокенов с ключом группы: ${grouped} (0 — нормально, пока не прогнан бэкфилл или реанализ).`)
console.log("Done.")
db.close()
