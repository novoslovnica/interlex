import type Database from "better-sqlite3"

/** Corpus-local history. No FK: retain evidence after token/document deletion. */
export function createHomonymReviewSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS corpus_homonym_batches (
      id TEXT PRIMARY KEY, groupKey TEXT NOT NULL, wordSlug TEXT NOT NULL,
      userId TEXT, userEmail TEXT, createdAt TEXT NOT NULL,
      undoneAt TEXT, undoneBy TEXT
    );
    CREATE TABLE IF NOT EXISTS corpus_homonym_batch_entries (
      batchId TEXT NOT NULL, tokenId TEXT NOT NULL,
      beforeState TEXT NOT NULL, afterState TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'active',
      PRIMARY KEY (batchId, tokenId)
    );
    CREATE INDEX IF NOT EXISTS corpus_homonym_entries_token_state
      ON corpus_homonym_batch_entries(tokenId, state);
  `)
  db.exec(`CREATE TRIGGER IF NOT EXISTS homonym_review_sentence_update
    AFTER UPDATE OF rawText ON CorpusSentence BEGIN
      UPDATE corpus_homonym_batch_entries SET state = 'conflict'
      WHERE state = 'active' AND tokenId IN (
        SELECT CAST(id AS TEXT) FROM CorpusToken WHERE sentenceId = OLD.id
      );
    END;`)
  // Invalidate even a later edit that writes the same values. Comparing values
  // alone would mistake a subsequent human decision for our own batch.
  for (const event of ["UPDATE", "DELETE"] as const) {
    db.exec(`CREATE TRIGGER IF NOT EXISTS homonym_review_token_${event.toLowerCase()}
      AFTER ${event} ON CorpusToken BEGIN
        UPDATE corpus_homonym_batch_entries SET state = 'conflict'
        WHERE tokenId = CAST(OLD.id AS TEXT) AND state = 'active';
      END;`)
  }
  for (const event of ["INSERT", "UPDATE", "DELETE"] as const) {
    const ref = event === "INSERT" ? "NEW" : "OLD"
    db.exec(`CREATE TRIGGER IF NOT EXISTS homonym_review_candidate_${event.toLowerCase()}
      AFTER ${event} ON CorpusTokenCandidate BEGIN
        UPDATE corpus_homonym_batch_entries SET state = 'conflict'
        WHERE tokenId = CAST(${ref}.tokenId AS TEXT) AND state = 'active';
      END;`)
  }
}
