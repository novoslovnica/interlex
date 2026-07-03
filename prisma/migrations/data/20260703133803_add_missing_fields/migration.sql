-- Migration: Add missing fields to words table
-- Adds slug, stem, base, gender, etc. for DB-powered tokenizer

-- 1. Add new nullable columns
ALTER TABLE "words" ADD COLUMN "slug" TEXT;
ALTER TABLE "words" ADD COLUMN "stem" TEXT;
ALTER TABLE "words" ADD COLUMN "base" TEXT;
ALTER TABLE "words" ADD COLUMN "gender" TEXT;
ALTER TABLE "words" ADD COLUMN "conjugation" INTEGER;
ALTER TABLE "words" ADD COLUMN "accentSyllable" INTEGER;
ALTER TABLE "words" ADD COLUMN "alternationType" TEXT;
ALTER TABLE "words" ADD COLUMN "fleetingVowelAt" INTEGER;

-- 2. Populate slug from existing isv + pos
UPDATE "words" SET "slug" = LOWER(TRIM(COALESCE("isv", ''))) || '-' || LOWER(TRIM(COALESCE("pos", 'unk')));

-- 3. Populate stem from isv (basic extraction: strip common endings)
UPDATE "words" SET "stem" = 
  CASE
    WHEN "isv" LIKE '%ti' AND "pos" = 'VERB' THEN SUBSTR("isv", 1, LENGTH("isv") - 2)
    WHEN "isv" LIKE '%ći' AND "pos" = 'VERB' THEN SUBSTR("isv", 1, LENGTH("isv") - 2)
    ELSE "isv"
  END;

-- 4. Populate base from stem (same as stem as initial pass)
UPDATE "words" SET "base" = "stem";

-- 5. Handle any remaining NULL slugs
UPDATE "words" SET "slug" = 'word-' || "id" WHERE "slug" IS NULL;

-- 6. Disambiguate duplicate slugs by appending id
UPDATE "words" SET "slug" = "slug" || '-' || "id" WHERE "slug" IN (
  SELECT "slug" FROM "words" GROUP BY "slug" HAVING COUNT(*) > 1
);

-- 7. Make slug NOT NULL and add UNIQUE index
CREATE UNIQUE INDEX "words_slug_key" ON "words"("slug");
CREATE INDEX "words_slug_idx" ON "words"("slug");