-- Migration: Add CEFR and genre columns
-- Run on production interlex.db and corpus.db
--
-- Usage:
--   sqlite3 interlex.db < scripts/db/migrations/005-add-cefr-columns.sql
--   sqlite3 corpus.db < scripts/db/migrations/005-add-cefr-columns.sql
--
-- Prisma equivalent:
--   npx prisma db push --schema=prisma/data.schema.prisma
--   npx prisma db push --schema=prisma/corpus.schema.prisma

-- ─── interlex.db: CEFR columns on lexemes ───
ALTER TABLE lexemes ADD COLUMN distributionD REAL;
ALTER TABLE lexemes ADD COLUMN usageScore REAL;
ALTER TABLE lexemes ADD COLUMN cefrLevel TEXT;

-- ─── corpus.db: genre column on CorpusDocument ───
ALTER TABLE CorpusDocument ADD COLUMN genre TEXT NOT NULL DEFAULT 'fiction';

-- ─── Verify interlex.db ───
SELECT 'interlex.db: distributionD' AS col FROM pragma_table_info('lexemes') WHERE name = 'distributionD'
UNION ALL
SELECT 'interlex.db: usageScore' FROM pragma_table_info('lexemes') WHERE name = 'usageScore'
UNION ALL
SELECT 'interlex.db: cefrLevel' FROM pragma_table_info('lexemes') WHERE name = 'cefrLevel';

-- ─── Verify corpus.db ───
SELECT 'corpus.db: genre' AS col FROM pragma_table_info('CorpusDocument') WHERE name = 'genre';

-- После миграции запустите пересчёт частотности и CEFR:
--   npx tsx scripts/compute-cefr-levels.ts
-- Или через админ-панель: Документы корпуса → «Пересчитать частотность и CEFR»