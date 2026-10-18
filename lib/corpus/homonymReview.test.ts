import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"
import { CORPUS_TEST_SCHEMA } from "@/scripts/db/lib/corpusTestSchema"
import { createHomonymReviewSchema } from "./homonymReviewSchema"
import { applyHomonymReview, fetchReviewBatches, fetchReviewContexts, HomonymReviewConflict, isReviewedTokens, undoHomonymReview } from "./homonymReview"

const databases: Database.Database[] = []
afterEach(() => { for (const db of databases.splice(0)) db.close() })
function fixture(count = 3) {
  const db = new Database(":memory:")
  databases.push(db)
  db.exec(CORPUS_TEST_SCHEMA)
  db.exec(`ALTER TABLE CorpusToken ADD COLUMN homonymGroupKey TEXT;
    INSERT INTO CorpusDocument (id, slug, title, rawText, updatedAt) VALUES ('d', 'doc', 'Document', '', '2026-10-18');
    INSERT INTO CorpusSegment (id, documentSlug, position, rawText) VALUES ('seg', 'doc', 0, '');`)
  for (let id = 1; id <= count; id++) {
    db.prepare(`INSERT INTO CorpusSentence (id, documentSlug, segmentId, position, rawText) VALUES (?, 'doc', 'seg', ?, ?)`)
      .run(`s${id}`, id, `Context ${id}: je.`)
    db.prepare(`INSERT INTO CorpusToken (id, documentSlug, sentenceId, tokenIndex, wordIndex, surfaceForm, lemma, pos, wordSlug, matchCount, homonymGroupKey)
      VALUES (?, 'doc', ?, ?, ?, 'je', 'byti', 'VERB', 'byti-VERB', 3, 'je␟byti-VERB|jesti-VERB')`).run(id, `s${id}`, id, id)
    for (const [slug, rank, feats] of [["byti-VERB", 0, '{"person":"3"}'], ["jesti-VERB", 1, '{"person":"2"}'], ["jesti-VERB", 2, '{"person":"3"}']] as const) {
      db.prepare(`INSERT INTO CorpusTokenCandidate (tokenId, wordSlug, lemma, pos, feats, rank) VALUES (?, ?, ?, 'VERB', ?, ?)`)
        .run(id, slug, slug.split("-")[0], feats, rank)
    }
  }
  createHomonymReviewSchema(db)
  return db
}
const groupKey = "je␟byti-VERB|jesti-VERB"
function apply(db: Database.Database, ids = ["1", "2"]) {
  const contexts = fetchReviewContexts(db, groupKey).contexts
  return applyHomonymReview(db, { groupKey, wordSlug: "jesti-VERB",
    tokens: contexts.filter((t) => ids.includes(t.tokenId)).map(({ tokenId, revision }) => ({ tokenId, revision })),
    user: { id: "moderator", email: "mod@example.org" } })
}
function state(db: Database.Database) {
  return { tokens: db.prepare("SELECT * FROM CorpusToken ORDER BY id").all(), candidates: db.prepare("SELECT * FROM CorpusTokenCandidate ORDER BY id").all() }
}

describe("contextual homonym batches", () => {
  it("changes only explicitly reviewed occurrences and retains each token's own grammar", () => {
    const db = fixture()
    const result = apply(db, ["2"])
    expect(result.resolvedTokens).toBe(1)
    expect(db.prepare("SELECT id, wordSlug FROM CorpusToken ORDER BY id").all()).toEqual([
      { id: 1, wordSlug: "byti-VERB" }, { id: 2, wordSlug: "jesti-VERB" }, { id: 3, wordSlug: "byti-VERB" },
    ])
    expect(db.prepare("SELECT feats FROM CorpusToken WHERE id = 2").get()).toEqual({ feats: '{"person":"2"}' })
    expect(fetchReviewBatches(db)[0]).toMatchObject({ id: result.batchId, total: 1, active: 1, userId: "moderator" })
  })
  it("restores token state, group queue and exact candidate ranks/sources; repeat undo is harmless", () => {
    const db = fixture()
    const before = state(db)
    const { batchId } = apply(db)
    expect(undoHomonymReview(db, batchId, "admin")).toEqual({ restored: 2, conflicts: 0 })
    expect(state(db)).toEqual(before)
    expect(undoHomonymReview(db, batchId, "admin")).toEqual({ restored: 0, conflicts: 0 })
    expect(fetchReviewBatches(db)[0]).toMatchObject({ active: 0, restored: 2 })
  })
  it("rejects a stale context and performs no partial batch", () => {
    const db = fixture()
    const tokens = fetchReviewContexts(db, groupKey).contexts
    db.prepare("UPDATE CorpusSentence SET rawText = 'Changed' WHERE id = 's2'").run()
    const before = state(db)
    expect(() => applyHomonymReview(db, { groupKey, wordSlug: "jesti-VERB", tokens, user: {} })).toThrow(HomonymReviewConflict)
    expect(state(db)).toEqual(before)
    expect(fetchReviewBatches(db)).toEqual([])
  })
  it("rejects a token from a different group and a missing winner", () => {
    const db = fixture()
    const tokens = fetchReviewContexts(db, groupKey).contexts
    expect(() => applyHomonymReview(db, { groupKey: "other", wordSlug: "jesti-VERB", tokens, user: {} })).toThrow(HomonymReviewConflict)
    expect(() => applyHomonymReview(db, { groupKey, wordSlug: "unknown", tokens, user: {} })).toThrow(HomonymReviewConflict)
    expect(fetchReviewBatches(db)).toEqual([])
  })
  it("protects a subsequent point edit even when it writes identical values", () => {
    const db = fixture()
    const { batchId } = apply(db)
    db.prepare("UPDATE CorpusToken SET resolutionSource = 'manual' WHERE id = 1").run()
    expect(undoHomonymReview(db, batchId, "admin")).toEqual({ restored: 1, conflicts: 1 })
    expect(db.prepare("SELECT wordSlug FROM CorpusToken WHERE id = 1").get()).toEqual({ wordSlug: "jesti-VERB" })
    expect(db.prepare("SELECT wordSlug FROM CorpusToken WHERE id = 2").get()).toEqual({ wordSlug: "byti-VERB" })
  })
  it.each(["UPDATE CorpusTokenCandidate SET score = 42 WHERE tokenId = 1", "DELETE FROM CorpusTokenCandidate WHERE tokenId = 1", "INSERT INTO CorpusTokenCandidate(tokenId, wordSlug, lemma, pos) VALUES (1, 'new', 'new', 'X')", "DELETE FROM CorpusToken WHERE id = 1"])("protects later candidate/token writes: %s", (sql) => {
    const db = fixture()
    const { batchId } = apply(db)
    db.exec(sql)
    expect(undoHomonymReview(db, batchId, "admin")).toEqual({ restored: 1, conflicts: 1 })
  })
  it("checks context again on undo", () => {
    const db = fixture()
    const { batchId } = apply(db)
    db.prepare("UPDATE CorpusSentence SET rawText = 'Changed' WHERE id = 's1'").run()
    expect(undoHomonymReview(db, batchId, "admin")).toEqual({ restored: 1, conflicts: 1 })
  })
  it("rolls back both journal and token changes if any write fails", () => {
    const db = fixture()
    db.exec("CREATE TRIGGER reject_second BEFORE UPDATE ON CorpusToken WHEN NEW.id = 2 BEGIN SELECT RAISE(ABORT, 'write failed'); END")
    const before = state(db)
    expect(() => apply(db)).toThrow("write failed")
    expect(state(db)).toEqual(before)
    expect(fetchReviewBatches(db)).toEqual([])
  })
  it("bounds context pages and supports cursor iteration without auto-selecting unseen occurrences", () => {
    const db = fixture(51)
    const first = fetchReviewContexts(db, groupKey)
    expect(first.contexts).toHaveLength(50)
    expect(first.nextCursor).toBe("50")
    expect(fetchReviewContexts(db, groupKey, first.nextCursor!).contexts.map((t) => t.tokenId)).toEqual(["51"])
  })
  it("rejects empty, duplicate, oversized and malformed selections", () => {
    const db = fixture()
    const [token] = fetchReviewContexts(db, groupKey).contexts
    for (const value of [undefined, [], [token, token], Array(51).fill(token), [{ tokenId: "-1", revision: token.revision }], [{ tokenId: "9223372036854775808", revision: token.revision }], [{ tokenId: "1", revision: "stale" }]]) {
      expect(isReviewedTokens(value)).toBe(false)
    }
    expect(() => applyHomonymReview(db, { groupKey, wordSlug: "jesti-VERB", tokens: [], user: {} })).toThrow()
    expect(undoHomonymReview(db, "missing", "admin")).toBeNull()
  })
  it("keeps per-occurrence automatic grammatical features distinct", () => {
    const db = fixture()
    db.prepare(`UPDATE CorpusTokenCandidate SET feats = '{"person":"1"}' WHERE tokenId = 2 AND rank = 1`).run()
    apply(db)
    expect(db.prepare("SELECT feats FROM CorpusToken WHERE id IN (1, 2) ORDER BY id").all()).toEqual([
      { feats: '{"person":"2"}' }, { feats: '{"person":"1"}' },
    ])
  })
  it("rolls back the entire undo if a restoring write fails", () => {
    const db = fixture()
    const { batchId } = apply(db)
    const after = state(db)
    db.exec("CREATE TRIGGER reject_restore BEFORE UPDATE ON CorpusToken WHEN NEW.id = 2 BEGIN SELECT RAISE(ABORT, 'restore failed'); END")
    expect(() => undoHomonymReview(db, batchId, "admin")).toThrow("restore failed")
    expect(state(db)).toEqual(after)
    expect(fetchReviewBatches(db)[0]).toMatchObject({ active: 2, restored: 0, undoneAt: null })
  })
  it("paginates persistent history beyond the latest 20 batches", () => {
    const db = fixture(21)
    for (let id = 1; id <= 21; id++) apply(db, [String(id)])
    const recent = fetchReviewBatches(db)
    const older = fetchReviewBatches(db, 20)
    expect(recent).toHaveLength(20)
    expect(older).toHaveLength(1)
    expect(new Set([...recent, ...older].map((b) => b.id)).size).toBe(21)
  })
  it("creates migration guards idempotently", () => {
    const db = fixture()
    createHomonymReviewSchema(db)
    apply(db)
    expect(fetchReviewBatches(db)).toHaveLength(1)
  })
})
