-- CreateTable
CREATE TABLE "lexemes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "slug" TEXT NOT NULL,
    "external_id" INTEGER,
    "value" TEXT,
    "transcription" TEXT,
    "mainCategory" TEXT,
    "usageType" TEXT,
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
    "stem" TEXT,
    "secondaryStem" TEXT,
    "tertiaryStem" TEXT,
    "governsCase" INTEGER,
    "gender" TEXT,
    "declension" INTEGER,
    "conjugation" INTEGER,
    "properNoun" BOOLEAN NOT NULL DEFAULT false,
    "hasAnomalies" BOOLEAN NOT NULL DEFAULT false,
    "actionHistory" TEXT
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "isv" TEXT,
    "nsl" TEXT,
    "transcription" TEXT,
    "mainCategory" TEXT,
    "usageType" TEXT,
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
    "stem" TEXT,
    "secondaryStem" TEXT,
    "tertiaryStem" TEXT,
    "governsCase" INTEGER,
    "gender" TEXT,
    "declension" INTEGER,
    "conjugation" INTEGER,
    "properNoun" BOOLEAN NOT NULL DEFAULT false,
    "hasAnomalies" BOOLEAN NOT NULL DEFAULT false,
    "actionHistory" TEXT,
    "promotedAt" DATETIME,
    "promotedToLexemeId" INTEGER
);

-- CreateTable
CREATE TABLE "meanings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lexemeId" INTEGER NOT NULL,
    "meaning" TEXT,
    "examples" TEXT,
    "meaningVeryfied" INTEGER,
    "meaningMessage" TEXT,
    "examplesVeryfied" INTEGER,
    "examplesMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "meanings_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "lexemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "morphemes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "type" INTEGER DEFAULT 0,
    "actionHistory" TEXT
);

-- CreateTable
CREATE TABLE "lexemes_morphemes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lexemeId" INTEGER,
    "morphemeId" INTEGER,
    CONSTRAINT "lexemes_morphemes_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "lexemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lexemes_morphemes_morphemeId_fkey" FOREIGN KEY ("morphemeId") REFERENCES "morphemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "allophone_flavors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "lexeme_allophones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lexemeId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "flavorId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'standard',
    CONSTRAINT "lexeme_allophones_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "lexemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lexeme_allophones_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "allophone_flavors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "morpheme_allophones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "morphemeId" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "flavorId" INTEGER NOT NULL,
    CONSTRAINT "morpheme_allophones_morphemeId_fkey" FOREIGN KEY ("morphemeId") REFERENCES "morphemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "morpheme_allophones_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "allophone_flavors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ending_allophones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stemType" TEXT NOT NULL,
    "grammeme" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "flavorId" INTEGER NOT NULL,
    CONSTRAINT "ending_allophones_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "allophone_flavors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "synonyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "synonyms_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "synonyms_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "antonyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "antonyms_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "antonyms_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hypernyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "hypernyms_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hypernyms_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hyponyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "hyponyms_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hyponyms_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meronyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "meronyms_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meronyms_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "holonyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "holonyms_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "holonyms_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "related_words" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "related_words_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "related_words_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "causes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "causes_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "causes_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "effects" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "effects_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "effects_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "premises" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "premises_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "premises_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conclusions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" INTEGER,
    "targetId" INTEGER,
    "proximity" REAL,
    CONSTRAINT "conclusions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conclusions_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "en" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "en_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "en_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ru" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "ru_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ru_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "mk_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mk_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sr" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "sr_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sr_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "uk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "uk_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "uk_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bg" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "bg_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bg_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "pl_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pl_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "be" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "be_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "be_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "cs_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cs_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sk" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "sk_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sk_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "sl_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sl_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hr" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "hr_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hr_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cu" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "cu_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cu_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "de" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "de_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "de_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "nl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "nl_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "nl_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "eo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "eo_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "eo_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hsb" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "hsb_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hsb_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "dsb" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "value" TEXT,
    "veryfied" INTEGER,
    "wordId" INTEGER,
    "meaningId" INTEGER,
    "actionHistory" TEXT,
    "message" TEXT,
    CONSTRAINT "dsb_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dsb_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "base_homonyms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "base" TEXT NOT NULL,
    "wordIds" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "inflection_anomalies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lexemeId" INTEGER NOT NULL,
    "inflection" TEXT NOT NULL,
    "grammeme" TEXT NOT NULL,
    CONSTRAINT "inflection_anomalies_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "lexemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "proto_slavic_words" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lemma" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "source_url" TEXT NOT NULL DEFAULT ''
);

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

-- CreateIndex
CREATE UNIQUE INDEX "lexemes_slug_key" ON "lexemes"("slug");

-- CreateIndex
CREATE INDEX "lexemes_slug_idx" ON "lexemes"("slug");

-- CreateIndex
CREATE INDEX "candidates_value_idx" ON "candidates"("value");

-- CreateIndex
CREATE INDEX "candidates_pos_idx" ON "candidates"("pos");

-- CreateIndex
CREATE UNIQUE INDEX "allophone_flavors_code_key" ON "allophone_flavors"("code");

-- CreateIndex
CREATE INDEX "lexeme_allophones_lexemeId_idx" ON "lexeme_allophones"("lexemeId");

-- CreateIndex
CREATE INDEX "lexeme_allophones_flavorId_idx" ON "lexeme_allophones"("flavorId");

-- CreateIndex
CREATE UNIQUE INDEX "lexeme_allophones_lexemeId_flavorId_type_key" ON "lexeme_allophones"("lexemeId", "flavorId", "type");

-- CreateIndex
CREATE INDEX "morpheme_allophones_morphemeId_idx" ON "morpheme_allophones"("morphemeId");

-- CreateIndex
CREATE INDEX "morpheme_allophones_flavorId_idx" ON "morpheme_allophones"("flavorId");

-- CreateIndex
CREATE UNIQUE INDEX "morpheme_allophones_morphemeId_flavorId_key" ON "morpheme_allophones"("morphemeId", "flavorId");

-- CreateIndex
CREATE INDEX "ending_allophones_flavorId_idx" ON "ending_allophones"("flavorId");

-- CreateIndex
CREATE UNIQUE INDEX "ending_allophones_stemType_grammeme_flavorId_key" ON "ending_allophones"("stemType", "grammeme", "flavorId");

-- CreateIndex
CREATE UNIQUE INDEX "base_homonyms_base_key" ON "base_homonyms"("base");

-- CreateIndex
CREATE INDEX "base_homonyms_base_idx" ON "base_homonyms"("base");

-- CreateIndex
CREATE INDEX "inflection_anomalies_lexemeId_idx" ON "inflection_anomalies"("lexemeId");

-- CreateIndex
CREATE INDEX "inflection_anomalies_grammeme_idx" ON "inflection_anomalies"("grammeme");

-- CreateIndex
CREATE INDEX "proto_slavic_words_lemma_idx" ON "proto_slavic_words"("lemma");
