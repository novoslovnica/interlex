-- Migration: Add audit fields (createdAt, updatedAt, actionHistory) to Word, Root, and all language translation tables
--
-- Prisma handles @default(now()) and @updatedAt at the application level,
-- so SQLite columns are added as nullable without defaults.

-- Roots table
ALTER TABLE "roots" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "roots" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "roots" ADD COLUMN "actionHistory" TEXT;

-- Language translation tables (16 languages)
ALTER TABLE "en" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "en" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "en" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "ru" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "ru" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "ru" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "mk" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "mk" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "mk" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "sr" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "sr" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "sr" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "uk" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "uk" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "uk" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "bg" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "bg" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "bg" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "pl" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "pl" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "pl" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "be" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "be" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "be" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "cs" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "cs" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "cs" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "sk" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "sk" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "sk" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "sl" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "sl" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "sl" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "hr" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "hr" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "hr" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "cu" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "cu" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "cu" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "de" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "de" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "de" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "nl" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "nl" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "nl" ADD COLUMN "actionHistory" TEXT;

ALTER TABLE "eo" ADD COLUMN "createdAt" DATETIME;
ALTER TABLE "eo" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "eo" ADD COLUMN "actionHistory" TEXT;

-- Backfill createdAt for all existing records
UPDATE "words" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "roots" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "en" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "ru" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "mk" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "sr" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "uk" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "bg" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "pl" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "be" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "cs" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "sk" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "sl" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "hr" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "cu" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "de" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "nl" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;
UPDATE "eo" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;