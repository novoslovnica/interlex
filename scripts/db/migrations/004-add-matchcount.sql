-- Migration: Add matchCount column to CorpusToken
-- Run on production corpus.db
-- 
-- Usage:
--   sqlite3 corpus.db < scripts/db/migrations/004-add-matchcount.sql
--
-- Prisma equivalent:
--   DB_TYPE=corpus npx prisma db push --schema=prisma/corpus.schema.prisma

ALTER TABLE CorpusToken ADD COLUMN matchCount INTEGER NOT NULL DEFAULT 1;

-- Verify
SELECT name, sql FROM sqlite_master WHERE type='table' AND name='CorpusToken';

-- После миграции пересчитайте POS-tagging для документов с фейковыми wordSlug:
-- Перейти в Admin → Corpus → Documents → нажать "Пересчитать POS-tagging"