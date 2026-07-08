-- CreateTable
CREATE TABLE "synsets" (
    "synsetId" TEXT NOT NULL PRIMARY KEY,
    "synset_external_id" TEXT,
    "definition" TEXT,
    "domains" TEXT,
    "semantic_codes" TEXT,
    "part_of_speech" TEXT
);

-- CreateTable
CREATE TABLE "meanings_synsets" (
    "meaningId" INTEGER NOT NULL,
    "synsetId" TEXT NOT NULL,
    "source" TEXT,
    "confidence" REAL,
    PRIMARY KEY ("meaningId", "synsetId"),
    CONSTRAINT "meanings_synsets_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meanings_synsets_synsetId_fkey" FOREIGN KEY ("synsetId") REFERENCES "synsets" ("synsetId") ON DELETE CASCADE ON UPDATE CASCADE
);