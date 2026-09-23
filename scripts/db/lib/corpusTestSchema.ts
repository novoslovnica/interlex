export const CORPUS_TEST_SCHEMA = `
CREATE TABLE "CorpusDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "rawText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'is',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "candidatesProcessed" BOOLEAN NOT NULL DEFAULT false
, genre TEXT NOT NULL DEFAULT 'fiction', "sourceUrl" TEXT, "externalId" TEXT, "sourceRevisionId" INTEGER);
CREATE UNIQUE INDEX "CorpusDocument_slug_key" ON "CorpusDocument"("slug");
CREATE UNIQUE INDEX "CorpusDocument_externalId_key" ON "CorpusDocument" ("externalId");
CREATE TABLE "CorpusSegment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentSlug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    CONSTRAINT "CorpusSegment_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CorpusSentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentSlug" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    CONSTRAINT "CorpusSentence_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CorpusSentence_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "CorpusSegment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
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
    "matchCount" INTEGER NOT NULL DEFAULT 1, "resolutionSource" TEXT NOT NULL DEFAULT 'auto', "isPartialMatch" BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT "CorpusToken_documentSlug_fkey" FOREIGN KEY ("documentSlug") REFERENCES "CorpusDocument" ("slug") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CorpusToken_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "CorpusSentence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "CorpusTokenCandidate" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "tokenId" BIGINT NOT NULL,
            "wordSlug" TEXT NOT NULL,
            "lemma" TEXT NOT NULL,
            "pos" TEXT NOT NULL,
            "feats" JSONB,
            "flavor" TEXT,
            "score" REAL NOT NULL DEFAULT 0,
            "source" TEXT NOT NULL DEFAULT 'form_freq',
            "rank" INTEGER NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CorpusTokenCandidate_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "CorpusToken" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
CREATE TABLE "CorpusDependency" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "sentenceId" TEXT NOT NULL,
            "headTokenId" BIGINT,
            "depTokenId" BIGINT NOT NULL,
            "relation" TEXT NOT NULL,
            "confidence" TEXT NOT NULL,
            "source" TEXT NOT NULL DEFAULT 'auto',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CorpusDependency_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "CorpusSentence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "CorpusDependency_headTokenId_fkey" FOREIGN KEY ("headTokenId") REFERENCES "CorpusToken" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "CorpusDependency_depTokenId_fkey" FOREIGN KEY ("depTokenId") REFERENCES "CorpusToken" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
CREATE UNIQUE INDEX "CorpusDependency_depTokenId_key" ON "CorpusDependency"("depTokenId");
CREATE TABLE "CorpusCandidateProposal" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "clusterKey" TEXT NOT NULL,
      "ruleSource" TEXT NOT NULL,
      "guessedPos" TEXT NOT NULL,
      "guessedStemType" TEXT NOT NULL,
      "guessedGrammeme" TEXT NOT NULL,
      "guessedStem" TEXT NOT NULL,
      "reconstructedForm" TEXT NOT NULL,
      "siblingWordSlug" TEXT,
      "possibleEndingGap" BOOLEAN NOT NULL DEFAULT 0,
      "rank" INTEGER NOT NULL DEFAULT 0,
      "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
      "exampleTokenIds" JSONB NOT NULL,
      "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "resolutionNote" TEXT,
      "candidateId" INTEGER,
      "reviewedByEmail" TEXT,
      "reviewedAt" DATETIME
    );
CREATE UNIQUE INDEX "CorpusCandidateProposal_cluster_rule_stem_grammeme_key" ON "CorpusCandidateProposal"("clusterKey", "ruleSource", "guessedStemType", "guessedGrammeme");
`
