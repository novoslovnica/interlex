-- CreateTable
CREATE TABLE "candidates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "isv" TEXT,
    "nsl" TEXT,
    "transcription" TEXT,
    "field" TEXT,
    "type" TEXT,
    "pos" TEXT,
    "aspect" TEXT,
    "transitivity" TEXT,
    "animacy" TEXT,
    "degree" TEXT,
    "pronType" TEXT,
    "numType" TEXT,
    "frequency" TEXT,
    "intelligibility" TEXT,
    "addition" TEXT,
    "sameInLanguages" TEXT,
    "etymology" TEXT,
    "proto" TEXT,
    "paradigm" TEXT,
    "protoStemClass" TEXT,
    "stemExtension" TEXT,
    "genesis" TEXT,
    "base" TEXT,
    "gender" TEXT,
    "declension" INTEGER,
    "conjugation" INTEGER,
    "accentSyllable" INTEGER,
    "alternationType" TEXT,
    "fleetingVowelAt" INTEGER,
    "hasAnomalies" BOOLEAN NOT NULL DEFAULT false,
    "actionHistory" TEXT,
    "promotedAt" DATETIME,
    "promotedToWordId" INTEGER
);

-- CreateIndex
CREATE INDEX "candidates_value_idx" ON "candidates"("value");
-- CreateIndex
CREATE INDEX "candidates_isv_idx" ON "candidates"("isv");
-- CreateIndex
CREATE INDEX "candidates_pos_idx" ON "candidates"("pos");
