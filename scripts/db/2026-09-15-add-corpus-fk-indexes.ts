// Индексы на внешних ключах, по которым идёт каскадное удаление корпуса.
//
// upsertCorpusDocument пересоздаёт документ удалением его сегментов,
// предложений и токенов. У CorpusToken.sentenceId и CorpusSentence.segmentId
// не было индексов, поэтому SQLite при удалении каждого предложения искал его
// токены полным просмотром CorpusToken (5,1 млн строк). Перетокенизация всего
// корпуса шла со скоростью ~1 документ в минуту — около 90 часов на 3 509
// документов.
//
// Идемпотентен (IF NOT EXISTS), схема Prisma описывает те же индексы.
// Usage: npx tsx scripts/db/2026-09-15-add-corpus-fk-indexes.ts

import Database from "better-sqlite3"
import path from "path"

const db = new Database(path.resolve(process.cwd(), "corpus.db"))

const statements = [
    `CREATE INDEX IF NOT EXISTS "CorpusToken_sentenceId_idx" ON "CorpusToken"("sentenceId")`,
    `CREATE INDEX IF NOT EXISTS "CorpusSentence_segmentId_idx" ON "CorpusSentence"("segmentId")`,
]

for (const sql of statements) {
    const started = Date.now()
    db.exec(sql)
    console.log(`${sql} — ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

db.close()
