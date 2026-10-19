import type Database from "better-sqlite3"

/** Additive, compatible with old writers. No initial scan of the corpus. */
export function createWorkbenchSchema(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(CorpusToken)").all() as { name: string }[]
  if (!columns.some((c) => c.name === "workbenchRevision")) {
    db.exec(`ALTER TABLE CorpusToken ADD COLUMN workbenchRevision TEXT NOT NULL DEFAULT ''`)
  }
  db.exec(`CREATE TABLE IF NOT EXISTS corpus_token_edits (
    id TEXT PRIMARY KEY, documentSlug TEXT NOT NULL, tokenId TEXT NOT NULL,
    userId TEXT, userEmail TEXT, createdAt TEXT NOT NULL,
    beforeState TEXT NOT NULL, afterState TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'active', undoneAt TEXT, undoneBy TEXT
  );
  CREATE INDEX IF NOT EXISTS corpus_token_edits_document ON corpus_token_edits(documentSlug, createdAt);
  CREATE INDEX IF NOT EXISTS corpus_token_edits_token ON corpus_token_edits(tokenId, state);
  CREATE TRIGGER IF NOT EXISTS workbench_token_insert AFTER INSERT ON CorpusToken BEGIN
    UPDATE CorpusToken SET workbenchRevision = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  CREATE TRIGGER IF NOT EXISTS workbench_token_revision AFTER UPDATE ON CorpusToken
    WHEN NEW.workbenchRevision = OLD.workbenchRevision BEGIN
    UPDATE CorpusToken SET workbenchRevision = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;`)
  for (const event of ["UPDATE", "DELETE"] as const) {
    db.exec(`CREATE TRIGGER IF NOT EXISTS workbench_token_${event.toLowerCase()} AFTER ${event} ON CorpusToken BEGIN
      UPDATE corpus_token_edits SET state = 'conflict' WHERE tokenId = CAST(OLD.id AS TEXT) AND state = 'active';
    END;`)
  }
  for (const event of ["INSERT", "UPDATE", "DELETE"] as const) {
    const refs = event === "UPDATE" ? ["OLD", "NEW"] : [event === "INSERT" ? "NEW" : "OLD"]
    db.exec(`CREATE TRIGGER IF NOT EXISTS workbench_candidate_${event.toLowerCase()} AFTER ${event} ON CorpusTokenCandidate BEGIN
      ${refs.map((ref) => `UPDATE CorpusToken SET workbenchRevision = lower(hex(randomblob(16))) WHERE id = ${ref}.tokenId;`).join("\n")}
    END;`)
  }
  // Context changes are edits too, including same-value updates and moves.
  for (const [table, fields, where] of [
    ["CorpusSentence", "rawText, segmentId, documentSlug, position", "sentenceId = OLD.id"],
    ["CorpusSegment", "rawText, documentSlug, position", "documentSlug = OLD.documentSlug AND sentenceId IN (SELECT s.id FROM CorpusSentence s JOIN CorpusSegment p ON p.id = s.segmentId WHERE p.documentSlug = OLD.documentSlug AND p.position BETWEEN OLD.position - 1 AND OLD.position + 1)"],
    ["CorpusDocument", "rawText", "documentSlug = OLD.slug"],
  ]) {
    db.exec(`CREATE TRIGGER IF NOT EXISTS workbench_context_${table} AFTER UPDATE OF ${fields} ON ${table} BEGIN
      UPDATE CorpusToken SET workbenchRevision = lower(hex(randomblob(16))) WHERE ${where};
    END;`)
  }
  for (const event of ["INSERT", "DELETE"] as const) {
    const ref = event === "INSERT" ? "NEW" : "OLD"
    db.exec(`CREATE TRIGGER IF NOT EXISTS workbench_context_segment_${event.toLowerCase()} AFTER ${event} ON CorpusSegment BEGIN
      UPDATE CorpusToken SET workbenchRevision = lower(hex(randomblob(16)))
        WHERE documentSlug = ${ref}.documentSlug AND sentenceId IN (
          SELECT s.id FROM CorpusSentence s JOIN CorpusSegment p ON p.id = s.segmentId
          WHERE p.documentSlug = ${ref}.documentSlug AND p.position BETWEEN ${ref}.position - 1 AND ${ref}.position + 1
        );
    END;`)
  }
}
