import type Database from "better-sqlite3"

/** Additive to both generations of editor; never rewrites token analysis. */
export function createWorkbenchAutomationSchema(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS corpus_review_tasks (
    id TEXT PRIMARY KEY, userId TEXT NOT NULL, documentSlug TEXT NOT NULL,
    tokenId TEXT NOT NULL, tokenIndex INTEGER NOT NULL, surfaceForm TEXT NOT NULL,
    sentenceText TEXT NOT NULL, ordinal INTEGER NOT NULL,
    reason TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
    tokenRevision TEXT NOT NULL, tokenStamp TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'deferred', version TEXT NOT NULL,
    proposalKey TEXT, proposalSeenStatus TEXT, completedByEditId TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
    UNIQUE(userId, documentSlug, tokenId)
  );
  CREATE INDEX IF NOT EXISTS corpus_review_tasks_queue ON corpus_review_tasks(userId, documentSlug, state, updatedAt);
  CREATE INDEX IF NOT EXISTS corpus_review_tasks_proposal ON corpus_review_tasks(proposalKey);
  CREATE INDEX IF NOT EXISTS CorpusToken_document_surface_position ON CorpusToken(documentSlug, surfaceForm, tokenIndex, id);`)
}
