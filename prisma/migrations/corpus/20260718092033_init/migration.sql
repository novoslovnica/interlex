-- CreateTable
CREATE TABLE "CorpusDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "rawText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'is',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CorpusSentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentSlug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    CONSTRAINT "CorpusSentence_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorpusToken" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "documentSlug" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "tokenIndex" INTEGER NOT NULL,
    "wordIndex" INTEGER NOT NULL,
    "surfaceForm" TEXT NOT NULL,
    "lemma" TEXT NOT NULL,
    "pos" TEXT NOT NULL,
    "feats" JSONB,
    "wordSlug" TEXT,
    CONSTRAINT "CorpusToken_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CorpusToken_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "CorpusSentence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WordFormPriority" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "surfaceForm" TEXT NOT NULL,
    "distributions" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CorpusDocument_slug_key" ON "CorpusDocument"("slug");

-- CreateIndex
CREATE INDEX "CorpusSentence_documentSlug_position_idx" ON "CorpusSentence"("documentSlug", "position");

-- CreateIndex
CREATE INDEX "CorpusToken_lemma_idx" ON "CorpusToken"("lemma");

-- CreateIndex
CREATE INDEX "CorpusToken_pos_idx" ON "CorpusToken"("pos");

-- CreateIndex
CREATE INDEX "CorpusToken_documentSlug_tokenIndex_idx" ON "CorpusToken"("documentSlug", "tokenIndex");

-- CreateIndex
CREATE INDEX "CorpusToken_wordSlug_idx" ON "CorpusToken"("wordSlug");

-- CreateIndex
CREATE UNIQUE INDEX "WordFormPriority_surfaceForm_key" ON "WordFormPriority"("surfaceForm");

-- CreateIndex
CREATE INDEX "WordFormPriority_surfaceForm_idx" ON "WordFormPriority"("surfaceForm");
