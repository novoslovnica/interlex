-- CreateTable
CREATE TABLE "words" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "external_id" INTEGER,
    "value" TEXT,
    "nsl" TEXT,
    "isv" TEXT,
    "transcription" TEXT,
    "field" TEXT,
    "declension" INTEGER,
    "etymology" TEXT,
    "genesis" TEXT,
    "type" TEXT,
    "pos" TEXT,
    "frequency" TEXT,
    "intelligibility" TEXT,
    "addition" TEXT,
    "sameInLanguages" TEXT,
    "proto" TEXT,
    "paradigm" TEXT,
    "protoStemClass" TEXT,
    "stemExtension" TEXT
);

-- CreateTable
CREATE TABLE "meanings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER NOT NULL,
    "meaning" TEXT,
    "examples" TEXT,
    CONSTRAINT "meanings_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "type" INTEGER DEFAULT 0
);

-- CreateTable
CREATE TABLE "roots_words" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wordId" INTEGER,
    "rootId" INTEGER,
    CONSTRAINT "roots_words_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "roots_words_rootId_fkey" FOREIGN KEY ("rootId") REFERENCES "roots" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "synonims" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rootId" INTEGER,
    "wordId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "synonims_rootId_fkey" FOREIGN KEY ("rootId") REFERENCES "words" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "synonims_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "antonims" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rootId" INTEGER,
    "wordId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "antonims_rootId_fkey" FOREIGN KEY ("rootId") REFERENCES "words" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "antonims_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "words" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "en" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "en_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "en_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ru" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "ru_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ru_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "mk_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mk_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sr" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "sr_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sr_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "uk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "uk_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "uk_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bg" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "bg_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bg_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "pl_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pl_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "be" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "be_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "be_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "cs_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cs_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "sk_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sk_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "sl_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sl_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hr" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "hr_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hr_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cu" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "cu_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cu_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "de" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "de_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "de_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "nl_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nl_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "eo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    CONSTRAINT "eo_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "eo_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
