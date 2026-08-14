// historical.db — новая, отдельная от corpus.db база под исторические корпуса
// (см. AGENTS.md "Historical Corpora" за архитектурным обоснованием split).
// Как и остальные *.db в проекте, схема создаётся сырым SQL через
// better-sqlite3, а не `prisma migrate dev` — тот же паттерн, что и
// scripts/db/2026-07-27-add-corpus-syntax-tables.ts, для единообразия
// со всем остальным проектом (даже несмотря на то что эта БД абсолютно новая
// и проблемы дрейфа тут в принципе нет).
//
// HistoricalToken.id — литеральный "INTEGER PRIMARY KEY" (не "BIGINT"), чтобы
// SQLite распознал колонку как алиас rowid и сам генерировал автоинкремент —
// эмпирически подтверждено (см. также комментарий в
// 2026-07-27-add-corpus-syntax-tables.ts): только буквальный тип "INTEGER" даёt
// настоящий rowid-автоинкремент, "BIGINT" — нет, вставка через Prisma-клиент
// с id=NULL тогда падает с Null constraint violation.
//
// Usage:
//   HISTORICAL_SQLITE_DB=/path/to/historical.db npx tsx scripts/db/2026-08-14-create-historical-db.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.HISTORICAL_SQLITE_DB || path.resolve(process.cwd(), "historical.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

const tx = db.transaction(() => {
    console.log("--- Creating HistoricalDocument table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "HistoricalDocument" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "slug" TEXT NOT NULL,
            "title" TEXT NOT NULL,
            "branch" TEXT NOT NULL,
            "period" TEXT,
            "sourceCorpus" TEXT NOT NULL,
            "sourceUrl" TEXT,
            "license" TEXT NOT NULL,
            "externalId" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "HistoricalDocument_slug_key" ON "HistoricalDocument"("slug")`)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "HistoricalDocument_externalId_key" ON "HistoricalDocument"("externalId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "HistoricalDocument_branch_idx" ON "HistoricalDocument"("branch")`)

    console.log("--- Creating HistoricalSentence table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "HistoricalSentence" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "documentSlug" TEXT NOT NULL,
            "position" INTEGER NOT NULL,
            "rawText" TEXT NOT NULL,
            CONSTRAINT "HistoricalSentence_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "HistoricalDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "HistoricalSentence_documentSlug_idx" ON "HistoricalSentence"("documentSlug")`)

    console.log("--- Creating HistoricalToken table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "HistoricalToken" (
            "id" INTEGER PRIMARY KEY,
            "documentSlug" TEXT NOT NULL,
            "sentenceId" TEXT NOT NULL,
            "tokenIndex" INTEGER NOT NULL,
            "form" TEXT NOT NULL,
            "formTranslit" TEXT,
            "lemma" TEXT NOT NULL,
            "lemmaTranslit" TEXT,
            "upos" TEXT NOT NULL,
            "feats" JSONB,
            CONSTRAINT "HistoricalToken_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "HistoricalDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "HistoricalToken_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "HistoricalSentence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "HistoricalToken_documentSlug_idx" ON "HistoricalToken"("documentSlug")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "HistoricalToken_sentenceId_idx" ON "HistoricalToken"("sentenceId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "HistoricalToken_lemmaTranslit_idx" ON "HistoricalToken"("lemmaTranslit")`)

    console.log("--- Creating HistoricalAttestation table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "HistoricalAttestation" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "branch" TEXT NOT NULL,
            "historicalLemma" TEXT NOT NULL,
            "lexemeId" INTEGER NOT NULL,
            "matchMethod" TEXT NOT NULL,
            "confidence" REAL NOT NULL DEFAULT 0,
            "status" TEXT NOT NULL DEFAULT 'proposed',
            "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
            "exampleTokenIds" JSONB NOT NULL,
            "note" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "HistoricalAttestation_branch_historicalLemma_lexemeId_key" ON "HistoricalAttestation"("branch", "historicalLemma", "lexemeId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "HistoricalAttestation_lexemeId_idx" ON "HistoricalAttestation"("lexemeId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "HistoricalAttestation_status_idx" ON "HistoricalAttestation"("status")`)
})

tx()

for (const table of ["HistoricalDocument", "HistoricalSentence", "HistoricalToken", "HistoricalAttestation"]) {
    const { c } = db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as { c: number }
    console.log(`${table} row count: ${c}`)
}
console.log("Done.")
db.close()
