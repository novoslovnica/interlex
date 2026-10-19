import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"
import { CORPUS_TEST_SCHEMA } from "@/scripts/db/lib/corpusTestSchema"
import { countManual, exportManual } from "@/scripts/db/corpus-export-manual"
import { importManual } from "@/scripts/db/corpus-import-manual"
import { createHomonymReviewSchema } from "./homonymReviewSchema"
import { applyHomonymReview, fetchReviewContexts, undoHomonymReview } from "./homonymReview"
import { createWorkbenchSchema } from "./workbenchSchema"
import { listTokenEdits, parseSelection, saveTokenEdit, tokenDetail, tokenQueue, undoTokenEdit, validFeats, validTokenId, WorkbenchConflict } from "./workbench"
const connections: Database.Database[] = []
afterEach(() => { for (const db of connections.splice(0)) db.close() })
function fixture(count = 3) {
  const db = new Database(":memory:")
  connections.push(db)
  db.exec(CORPUS_TEST_SCHEMA)
  db.exec(`ALTER TABLE CorpusToken ADD COLUMN homonymGroupKey TEXT;
    INSERT INTO CorpusDocument (id, slug, title, rawText, updatedAt) VALUES ('d', 'doc', 'Document', '', '2026-10-19');
    INSERT INTO CorpusSegment (id, documentSlug, position, rawText) VALUES ('seg', 'doc', 1, 'je je');
    INSERT INTO CorpusSegment (id, documentSlug, position, rawText) VALUES ('prev', 'doc', 0, 'Before');
    INSERT INTO CorpusSegment (id, documentSlug, position, rawText) VALUES ('next', 'doc', 2, 'After');
    INSERT INTO CorpusSentence (id, documentSlug, segmentId, position, rawText) VALUES ('s', 'doc', 'seg', 0, 'je je');`)
  for (let id = 1; id <= count; id++) {
    db.prepare(`INSERT INTO CorpusToken (id, documentSlug, sentenceId, tokenIndex, wordIndex, surfaceForm, lemma, pos, matchCount, isPartialMatch, homonymGroupKey) VALUES (?, 'doc', 's', ?, ?, 'je', 'byti', 'VERB', 2, 1, 'group')`).run(id, id, id)
    for (const [rank, slug] of [[0, "byti-VERB"], [1, "jesti-VERB"]] as const) db.prepare(`INSERT INTO CorpusTokenCandidate (tokenId, wordSlug, lemma, pos, feats, rank) VALUES (?, ?, ?, 'VERB', '{"person":"3"}', ?)`).run(id, slug, slug, rank)
  }
  createHomonymReviewSchema(db)
  createWorkbenchSchema(db)
  return db
}
function save(db: Database.Database, tokenId = "1") {
  const detail = tokenDetail(db, "doc", tokenId)!
  return saveTokenEdit(db, { slug: "doc", tokenId, revision: detail.revision, selection: { candidateId: detail.candidates[1].id }, user: { id: "mod", email: "mod@example.org" } })
}
function logicalState(db: Database.Database, id = "1") {
  const detail = tokenDetail(db, "doc", id)!
  const token: Partial<typeof detail.token> = { ...detail.token }
  delete token.workbenchRevision
  return { token, candidates: detail.candidates }
}
describe("corpus workbench point edits", () => {
  it("is additive/idempotent and leaves existing token values intact", () => {
    const db = fixture()
    const before = logicalState(db)
    createWorkbenchSchema(db)
    expect(logicalState(db)).toEqual(before)
    expect(tokenQueue(db, "doc", "problems").tokens).toHaveLength(3)
  })
  it.each([false, true])("saves only one occurrence and restores its exact analysis; recursive triggers=%s", (recursive) => {
    const db = fixture()
    db.pragma(`recursive_triggers = ${recursive ? "ON" : "OFF"}`)
    const before = logicalState(db)
    const revision = tokenDetail(db, "doc", "1")!.revision
    const { editId } = save(db)
    expect(tokenDetail(db, "doc", "1")!.token).toMatchObject({ wordSlug: "jesti-VERB", matchCount: 1, isPartialMatch: 0, resolutionSource: "manual", homonymGroupKey: null })
    expect(tokenDetail(db, "doc", "2")!.token.resolutionSource).toBe("auto")
    expect(listTokenEdits(db, "doc")[0]).toMatchObject({ id: editId, state: "active", userEmail: "mod@example.org" })
    expect(undoTokenEdit(db, "doc", editId, "admin")).toEqual({ restored: true, conflict: false })
    expect(logicalState(db)).toEqual(before)
    expect(tokenDetail(db, "doc", "1")!.revision).not.toBe(revision) // ABA safe
    expect(undoTokenEdit(db, "doc", editId, "admin")).toEqual({ restored: false, conflict: false })
  })
  it.each([
    "UPDATE CorpusToken SET lemma = lemma WHERE id = 1",
    "UPDATE CorpusTokenCandidate SET rank = rank WHERE tokenId = 1",
    "INSERT INTO CorpusTokenCandidate (tokenId, wordSlug, lemma, pos) VALUES (1, 'new', 'new', 'X')",
    "DELETE FROM CorpusTokenCandidate WHERE tokenId = 1",
    "UPDATE CorpusSentence SET rawText = rawText WHERE id = 's'",
    "UPDATE CorpusSegment SET rawText = rawText WHERE id = 'seg'",
    "UPDATE CorpusSegment SET rawText = rawText WHERE id = 'prev'",
    "UPDATE CorpusDocument SET rawText = rawText WHERE slug = 'doc'",
    "DELETE FROM CorpusToken WHERE id = 1",
  ])("rejects stale saves and unsafe undo after legacy/raw writer: %s", (sql) => {
    const db = fixture()
    const { editId } = save(db)
    const detail = tokenDetail(db, "doc", "1")!
    db.exec(sql)
    const afterOtherEdit = db.prepare("SELECT * FROM CorpusToken ORDER BY id").all()
    expect(() => saveTokenEdit(db, { slug: "doc", tokenId: "1", revision: detail.revision, selection: { candidateId: detail.candidates[0].id }, user: {} })).toThrow(WorkbenchConflict)
    expect(undoTokenEdit(db, "doc", editId, "admin")).toEqual({ restored: false, conflict: true })
    expect(db.prepare("SELECT * FROM CorpusToken ORDER BY id").all()).toEqual(afterOtherEdit)
  })
  it("guards both owners when a candidate is moved", () => {
    const db = fixture()
    const a = save(db, "1"); const b = save(db, "2")
    db.exec("UPDATE CorpusTokenCandidate SET tokenId = 2 WHERE tokenId = 1")
    expect(undoTokenEdit(db, "doc", a.editId, "admin").conflict).toBe(true)
    expect(undoTokenEdit(db, "doc", b.editId, "admin").conflict).toBe(true)
  })
  it("does not revive an older undo after a newer edit is undone", () => {
    const db = fixture()
    const a = save(db); const b = save(db)
    expect(undoTokenEdit(db, "doc", b.editId, "admin").restored).toBe(true)
    expect(undoTokenEdit(db, "doc", a.editId, "admin").conflict).toBe(true)
  })
  it("adds a manual dictionary choice and undo removes only the new candidate", () => {
    const db = fixture()
    const before = logicalState(db)
    const detail = tokenDetail(db, "doc", "1")!
    const { editId } = saveTokenEdit(db, { slug: "doc", tokenId: "1", revision: detail.revision, selection: { wordSlug: "new-NOUN", feats: { case: "nom", number: "sg" } }, manualLexeme: { slug: "new-NOUN", lemma: "new", pos: "NOUN" }, user: {} })
    expect(tokenDetail(db, "doc", "1")!.candidates).toHaveLength(3)
    expect(undoTokenEdit(db, "doc", editId, "admin").restored).toBe(true)
    expect(logicalState(db)).toEqual(before)
  })
  it("reuses an identical existing analysis instead of adding duplicate candidates", () => {
    const db = fixture()
    const before = logicalState(db)
    const d = tokenDetail(db, "doc", "1")!
    const saved = saveTokenEdit(db, { slug: "doc", tokenId: "1", revision: d.revision, selection: { wordSlug: "byti-VERB", feats: { person: "3" } }, manualLexeme: { slug: "byti-VERB", lemma: "byti-VERB", pos: "VERB" }, user: {} })
    expect(tokenDetail(db, "doc", "1")!.candidates).toHaveLength(2)
    expect(undoTokenEdit(db, "doc", saved.editId, "admin").restored).toBe(true)
    expect(logicalState(db)).toEqual(before)
  })
  it("rolls back writes and journal together on failure", () => {
    const db = fixture()
    const before = logicalState(db)
    db.exec("CREATE TRIGGER reject_journal BEFORE INSERT ON corpus_token_edits BEGIN SELECT RAISE(ABORT, 'write failed'); END")
    expect(() => save(db)).toThrow("write failed")
    expect(logicalState(db)).toEqual(before)
    expect(listTokenEdits(db, "doc")).toEqual([])
  })
  it("rolls back the undo journal and candidate restoration if a restoring write fails", () => {
    const db = fixture()
    const { editId } = save(db)
    const after = logicalState(db)
    db.exec("CREATE TRIGGER reject_restore BEFORE UPDATE ON CorpusToken BEGIN SELECT RAISE(ABORT, 'restore failed'); END")
    expect(() => undoTokenEdit(db, "doc", editId, "admin")).toThrow("restore failed")
    expect(logicalState(db)).toEqual(after)
    expect(listTokenEdits(db, "doc")[0].state).toBe("active")
  })
  it("does not modify a token in another document or accept another token's candidate", () => {
    const db = fixture()
    const d = tokenDetail(db, "doc", "1")!
    expect(() => saveTokenEdit(db, { slug: "other", tokenId: "1", revision: d.revision, selection: { candidateId: d.candidates[0].id }, user: {} })).toThrow(WorkbenchConflict)
    expect(() => saveTokenEdit(db, { slug: "doc", tokenId: "1", revision: d.revision, selection: { candidateId: tokenDetail(db, "doc", "2")!.candidates[0].id }, user: {} })).toThrow()
    expect(listTokenEdits(db, "doc")).toEqual([])
  })
  it("includes the exact highlight alignment in the revision", () => {
    const db = fixture()
    const old = tokenDetail(db, "doc", "2")!
    db.exec("UPDATE CorpusToken SET surfaceForm = 'other' WHERE id = 1")
    expect(tokenDetail(db, "doc", "2")!.highlight).toBeNull()
    expect(() => saveTokenEdit(db, { slug: "doc", tokenId: "2", revision: old.revision, selection: { candidateId: old.candidates[0].id }, user: {} })).toThrow(WorkbenchConflict)
  })
  it("protects old batch undo after a point save, and point undo after a batch write", () => {
    const db = fixture()
    const contexts = fetchReviewContexts(db, "group").contexts
    const batch = applyHomonymReview(db, { groupKey: "group", wordSlug: "jesti-VERB", tokens: contexts.filter((c) => c.tokenId === "1"), user: {} })
    const point = save(db)
    expect(undoHomonymReview(db, batch.batchId, "admin")).toEqual({ restored: 0, conflicts: 1 })
    expect(undoTokenEdit(db, "doc", point.editId, "admin").restored).toBe(true)
    // An external batch-like write invalidates point history too.
    const second = save(db)
    db.exec("UPDATE CorpusToken SET resolutionSource = 'manual' WHERE id = 1")
    expect(undoTokenEdit(db, "doc", second.editId, "admin").conflict).toBe(true)
  })
  it("uses seek pagination after saving, excludes punctuation, and distinguishes unresolved filters", () => {
    const db = fixture(103)
    db.exec("UPDATE CorpusToken SET wordIndex = -1, matchCount = 0 WHERE id = 2")
    const first = tokenQueue(db, "doc", "problems")
    expect(first.tokens).toHaveLength(50); expect(first.more).toBe(true)
    expect(first.tokens.map((t) => t.id)).not.toContain("2")
    save(db, "1")
    expect(tokenQueue(db, "doc", "problems", "1").tokens[0].id).toBe("3")
    expect(tokenQueue(db, "doc", "manual").tokens.map((t) => t.id)).toEqual(["1"])
    expect(tokenQueue(db, "doc", "all", "3", "before").tokens.map((t) => t.id)).toEqual(["1"])
    expect(() => tokenQueue(db, "doc", "all", "999")).toThrow(WorkbenchConflict)
  })
  it("highlights the exact repeated occurrence and bounds paragraph context", () => {
    const db = fixture()
    expect(tokenDetail(db, "doc", "2")!.highlight).toEqual({ before: "je ", word: "je", after: "" })
    expect(tokenDetail(db, "doc", "3")!.highlight).toBeNull()
    expect(tokenDetail(db, "doc", "1")!.context.map((p) => p.id)).toEqual(["prev", "seg", "next"])
    db.prepare("UPDATE CorpusSegment SET rawText = ? WHERE id = 'seg'").run("x".repeat(20000))
    expect(tokenDetail(db, "doc", "1")!.context[1].rawText).toHaveLength(16000)
  })
  it("preserves point journal on corpus import and makes original-id undo unsafe", () => {
    const db = fixture()
    const { editId } = save(db)
    const data = exportManual(db, "prod")
    expect(data.pointEditHistory?.[0]).toMatchObject({ id: editId, state: "active" })
    const checksum = countManual(db).pointEditHistory
    undoTokenEdit(db, "doc", editId, "admin")
    expect(countManual(db).pointEditHistory).not.toBe(checksum)
    const rebuilt = fixture()
    importManual(rebuilt, data)
    expect(tokenDetail(rebuilt, "doc", "1")!.token.wordSlug).toBe("jesti-VERB")
    expect(listTokenEdits(rebuilt, "doc")[0]).toMatchObject({ id: editId, state: "conflict" })
    expect(undoTokenEdit(rebuilt, "doc", editId, "admin").conflict).toBe(true)
    expect((rebuilt.prepare("SELECT beforeState FROM corpus_token_edits WHERE id = ?").get(editId) as { beforeState: string }).beforeState).toBe(data.pointEditHistory![0].beforeState)
  })
  it("validates ids and selections without accepting arbitrary JSON values", () => {
    for (const id of ["0", "-1", "1e2", "9223372036854775808", null]) expect(validTokenId(id)).toBe(false)
    expect(validTokenId("9223372036854775807")).toBe(true)
    expect(validFeats({ case: "nom" })).toBe(true)
    for (const value of [null, [], { number: 3 }, { case: {} }]) expect(validFeats(value)).toBe(false)
    for (const value of [{ candidateId: 1, wordSlug: "x" }, { candidateId: 1.5 }, { wordSlug: "x", feats: [] }, null]) expect(() => parseSelection(value)).toThrow()
  })
})
