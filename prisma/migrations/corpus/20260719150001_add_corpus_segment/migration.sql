-- Create CorpusSegment table
CREATE TABLE IF NOT EXISTS "CorpusSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentSlug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    CONSTRAINT "CorpusSegment_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CorpusSegment_documentSlug_position_idx" ON "CorpusSegment" ("documentSlug", "position");

-- Add segmentId column to CorpusSentence (nullable for backfill)
ALTER TABLE "CorpusSentence" ADD COLUMN "segmentId" TEXT;

-- Backfill: create one segment per existing document, assign all its sentences to it
INSERT INTO "CorpusSegment" ("id", "documentSlug", "position", "rawText")
    SELECT hex(randomblob(16)), "slug", 0, "rawText"
    FROM "CorpusDocument";

UPDATE "CorpusSentence" SET "segmentId" = (
    SELECT "id" FROM "CorpusSegment" WHERE "CorpusSegment"."documentSlug" = "CorpusSentence"."documentSlug"
);