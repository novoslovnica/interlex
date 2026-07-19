/*
  Warnings:

  - Made the column `segmentId` on table `CorpusSentence` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CorpusSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentSlug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    CONSTRAINT "CorpusSegment_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CorpusSegment" ("documentSlug", "id", "position", "rawText") SELECT "documentSlug", "id", "position", "rawText" FROM "CorpusSegment";
DROP TABLE "CorpusSegment";
ALTER TABLE "new_CorpusSegment" RENAME TO "CorpusSegment";
CREATE INDEX "CorpusSegment_documentSlug_position_idx" ON "CorpusSegment"("documentSlug", "position");
CREATE TABLE "new_CorpusSentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentSlug" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    CONSTRAINT "CorpusSentence_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CorpusSentence_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CorpusSegment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CorpusSentence" ("documentSlug", "id", "position", "rawText", "segmentId") SELECT "documentSlug", "id", "position", "rawText", "segmentId" FROM "CorpusSentence";
DROP TABLE "CorpusSentence";
ALTER TABLE "new_CorpusSentence" RENAME TO "CorpusSentence";
CREATE INDEX "CorpusSentence_documentSlug_position_idx" ON "CorpusSentence"("documentSlug", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
DROP INDEX "sqlite_autoindex_corpus_config_1";
CREATE UNIQUE INDEX "corpus_config_key_key" ON "corpus_config"("key");
