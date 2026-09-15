// Таблица признаков кластера очереди кандидатов: иностранный контекст,
// словоизменение, распределённость по документам (см.
// lib/corpus/candidates/clusterSignals.ts). Производная — пересчитывается
// целиком каждым прогоном computeClusterSignals, ручных данных в ней нет.
//
// corpus.db не ведёт _prisma_migrations, поэтому raw SQL, как и в
// scripts/db/2026-07-29-add-corpus-candidate-proposals.ts. Идемпотентен.
//
// Usage:
//   CORPUS_SQLITE_DB=/path/to/corpus.db npx tsx scripts/db/2026-09-15-add-corpus-cluster-signals.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS "CorpusClusterSignal" (
    "clusterKey" TEXT NOT NULL PRIMARY KEY,
    "occurrenceCount" INTEGER NOT NULL,
    "documentCount" INTEGER NOT NULL,
    "isvContextShare" REAL,
    "inflectedSiblings" JSONB NOT NULL,
    "signal" TEXT,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)
db.exec(`CREATE INDEX IF NOT EXISTS "CorpusClusterSignal_signal_idx" ON "CorpusClusterSignal"("signal")`)

const count = (db.prepare(`SELECT COUNT(*) c FROM "CorpusClusterSignal"`).get() as { c: number }).c
console.log(`CorpusClusterSignal row count: ${count}`)
console.log("Done.")
db.close()
