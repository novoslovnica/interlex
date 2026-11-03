import Database from "better-sqlite3"
import { afterEach, describe, expect, it } from "vitest"
import { CORPUS_TEST_SCHEMA } from "@/scripts/db/lib/corpusTestSchema"
import { exportManual, countManual } from "@/scripts/db/corpus-export-manual"
import { importManual } from "@/scripts/db/corpus-import-manual"
import { createHomonymReviewSchema } from "./homonymReviewSchema"
import { createWorkbenchSchema } from "./workbenchSchema"
import { createWorkbenchAutomationSchema } from "./workbenchAutomationSchema"
import { tokenDetail, saveTokenEdit, undoTokenEdit, WorkbenchConflict } from "./workbench"
import { assistance, acceptRecommendation, recommend, deferTask, taskList, closeTask } from "./workbenchAutomation"
const connections: Database.Database[] = []
afterEach(() => { for (const db of connections.splice(0)) db.close() })
function fixture(count = 4, offset = 0) {
  const db = new Database(":memory:"); connections.push(db)
  db.exec(CORPUS_TEST_SCHEMA)
  db.exec(`ALTER TABLE CorpusToken ADD COLUMN homonymGroupKey TEXT;
    INSERT INTO CorpusDocument(id,slug,title,rawText,updatedAt) VALUES('doc','doc','Document','','2026-11-03');
    INSERT INTO CorpusSegment(id,documentSlug,position,rawText) VALUES('seg','doc',0,'Ja vidžu domu segodnja.');`)
  for (let i = 1; i <= count; i++) {
    db.prepare("INSERT INTO CorpusSentence(id,documentSlug,segmentId,position,rawText) VALUES(?,'doc','seg',?,'Ja vidžu domu segodnja.')").run(`s${i}`, i)
    const id = i + offset
    db.prepare(`INSERT INTO CorpusToken(id,documentSlug,sentenceId,tokenIndex,wordIndex,surfaceForm,lemma,pos,matchCount,homonymGroupKey) VALUES(?,'doc',?,?,0,'domu','dom','NOUN',2,'group')`).run(id, `s${i}`, i)
    for (const [rank, gram] of [[0, "dat"], [1, "gen"]] as const) db.prepare("INSERT INTO CorpusTokenCandidate(tokenId,wordSlug,lemma,pos,feats,rank) VALUES(?,'dom-NOUN','dom','NOUN',?,?)").run(id, JSON.stringify({ case: gram, number: "sg" }), rank)
  }
  createHomonymReviewSchema(db); createWorkbenchSchema(db); createWorkbenchAutomationSchema(db)
  return db
}
function resolve(db: Database.Database, id = "1", rank = 1) {
  const d = tokenDetail(db, "doc", id)!
  return saveTokenEdit(db, { slug: "doc", tokenId: id, revision: d.revision, selection: { candidateId: d.candidates[rank].id }, user: { id: "editor" } })
}
function defer(db: Database.Database, id = "1", user = "editor", proposal = false) {
  return deferTask(db, "doc", user, { tokenId: id, revision: tokenDetail(db, "doc", id)!.revision, taskVersion: null, reason: proposal ? "missing_lexeme" : "consultation", note: "Проверить контекст", ...(proposal ? { proposal: { value: "novy", pos: "NOUN" } } : {}) })
}
describe("editor assistance", () => {
  it("leaves ambiguous ties and stem-only guesses without a recommendation", () => {
    const db = fixture()
    expect(recommend(db, tokenDetail(db, "doc", "1")!)).toBeNull()
    db.exec("UPDATE CorpusToken SET isPartialMatch=1 WHERE id=1; UPDATE CorpusTokenCandidate SET score=10 WHERE tokenId=1 AND rank=0")
    expect(recommend(db, tokenDetail(db, "doc", "1")!)).toBeNull()
  })
  it("explains contextual case selection using existing government data", () => {
    const db = fixture()
    db.exec("UPDATE CorpusSentence SET rawText='k domu' WHERE id='s1'")
    const d = tokenDetail(db, "doc", "1")!
    const r = recommend(db, d)!
    expect(r.kind).toBe("context"); expect(r.candidateId).toBe(d.candidates[0].id)
    expect(r.reasons.join(" ")).toContain("k")
    const saved = acceptRecommendation(db, { slug: "doc", tokenId: "1", revision: d.revision, recommendationRevision: r.revision, candidateId: r.candidateId, user: { id: "editor" } })
    expect(saved.editId).toBeTruthy()
    expect(tokenDetail(db, "doc", "1")!.token.resolutionSource).toBe("manual")
  })
  it("does not infer preposition government across intervening punctuation", () => {
    const db = fixture(); db.exec("UPDATE CorpusSentence SET rawText='k, domu' WHERE id='s1'")
    expect(recommend(db, tokenDetail(db, "doc", "1")!)).toBeNull()
  })
  it("keeps existing task data unchanged when the schema is initialized again", () => {
    const db = fixture(); defer(db)
    const before = countManual(db).workbenchWorkflow
    createWorkbenchAutomationSchema(db)
    expect(countManual(db).workbenchWorkflow).toBe(before)
  })
  it("reuses full analysis only from still-active, unchanged reviewed examples", () => {
    const db = fixture(); const original = resolve(db)
    const d = tokenDetail(db, "doc", "2")!
    const r = recommend(db, d)!
    expect(r.kind).toBe("reviewed"); expect(r.candidateId).toBe(d.candidates[1].id)
    undoTokenEdit(db, "doc", original.editId, "editor")
    expect(() => acceptRecommendation(db, { slug: "doc", tokenId: "2", revision: d.revision, recommendationRevision: r.revision, candidateId: r.candidateId, user: { id: "editor" } })).toThrow(WorkbenchConflict)
    expect(tokenDetail(db, "doc", "2")!.token.resolutionSource).toBe("auto")
    expect(recommend(db, tokenDetail(db, "doc", "2")!)).toBeNull()
  })
  it("does not transfer case across different contexts or incompatible candidate features", () => {
    const db = fixture(); resolve(db)
    db.exec("UPDATE CorpusSentence SET rawText='k domu' WHERE id='s2'")
    expect(recommend(db, tokenDetail(db, "doc", "2")!)?.kind).toBe("context")
    db.exec("DELETE FROM CorpusTokenCandidate WHERE tokenId=3 AND rank=1")
    expect(recommend(db, tokenDetail(db, "doc", "3")!)?.kind).toBe("analyzer")
  })
  it("does not transfer a reviewed regional variant to another flavor", () => {
    const db = fixture()
    db.exec("UPDATE CorpusTokenCandidate SET flavor='EAST' WHERE tokenId=1")
    resolve(db)
    expect(recommend(db, tokenDetail(db, "doc", "2")!)).toBeNull()
  })
  it("does not pick between contradictory active human decisions", () => {
    const db = fixture(); resolve(db, "1", 0); resolve(db, "2", 1)
    expect(recommend(db, tokenDetail(db, "doc", "3")!)).toBeNull()
  })
  it("does not treat unjournaled manual tokens as trusted examples", () => {
    const db = fixture(); db.exec("UPDATE CorpusToken SET resolutionSource='manual', wordSlug='dom-NOUN', feats='{\"case\":\"gen\"}' WHERE id=1")
    expect(recommend(db, tokenDetail(db, "doc", "2")!)).toBeNull()
  })
  it("rejects stale target versions and never automatically mutates similar occurrences", () => {
    const db = fixture(); resolve(db)
    const d = tokenDetail(db, "doc", "2")!; const r = recommend(db, d)!
    db.exec("UPDATE CorpusToken SET lemma=lemma WHERE id=2")
    expect(() => acceptRecommendation(db, { slug: "doc", tokenId: "2", revision: d.revision, recommendationRevision: r.revision, candidateId: r.candidateId, user: { id: "editor" } })).toThrow(WorkbenchConflict)
    const a = assistance(db, "doc", "2")
    expect(a.similar.map((t) => t.id)).toEqual(["3", "4"])
    expect(a.similar.every((t) => t.sameContext)).toBe(true)
    expect(tokenDetail(db, "doc", "3")!.token.resolutionSource).toBe("auto")
  })
  it("bounds and paginates similar contexts and uses the document/surface index", () => {
    const db = fixture(44)
    const first = assistance(db, "doc", "1")
    expect(first.similar).toHaveLength(20); expect(first.nextCursor).toBe("21")
    const second = assistance(db, "doc", "1", first.nextCursor!)
    expect(second.similar[0].id).toBe("22")
    expect(second.similar[0].highlight?.word).toBe("domu")
    const plan = db.prepare("EXPLAIN QUERY PLAN SELECT id FROM CorpusToken WHERE documentSlug=? AND surfaceForm=? ORDER BY tokenIndex,id LIMIT 21").all("doc", "domu") as { detail: string }[]
    expect(plan.some((p) => p.detail.includes("CorpusToken_document_surface_position"))).toBe(true)
  })
})
describe("personal review tasks", () => {
  it("stores reasons without changing annotations and isolates accounts", () => {
    const db = fixture(); const before = tokenDetail(db, "doc", "1")!
    const task = defer(db)
    expect(tokenDetail(db, "doc", "1")).toEqual(before)
    expect(taskList(db, "doc", "editor")[0]).toMatchObject({ id: task.id, reason: "consultation", status: "deferred" })
    expect(taskList(db, "doc", "other")).toEqual([])
    expect(() => closeTask(db, "doc", "other", task.id, task.version)).toThrow(WorkbenchConflict)
  })
  it("rejects stale task and token versions, permits explicit reopen", () => {
    const db = fixture(); const task = defer(db)
    expect(() => defer(db)).toThrow(WorkbenchConflict)
    closeTask(db, "doc", "editor", task.id, task.version)
    expect(taskList(db, "doc", "editor")).toEqual([])
    const closed = db.prepare("SELECT version FROM corpus_review_tasks WHERE id=?").get(task.id) as { version: string }
    const d = tokenDetail(db, "doc", "1")!
    const reopened = deferTask(db, "doc", "editor", { tokenId: "1", revision: d.revision, taskVersion: closed.version, reason: "typo", note: "Проверить источник" })
    db.exec("UPDATE CorpusToken SET lemma=lemma WHERE id=1")
    expect(taskList(db, "doc", "editor")[0].status).toBe("ready")
    expect(() => deferTask(db, "doc", "editor", { tokenId: "1", revision: d.revision, taskVersion: reopened.version, reason: "typo", note: "" })).toThrow(WorkbenchConflict)
  })
  it("closes only the saving user's task and reopens it on safe undo", () => {
    const db = fixture(); defer(db); defer(db, "1", "other")
    const { editId } = resolve(db)
    expect(taskList(db, "doc", "editor")).toEqual([])
    expect(taskList(db, "doc", "other")[0].status).toBe("ready")
    expect(undoTokenEdit(db, "doc", editId, "editor").restored).toBe(true)
    expect(taskList(db, "doc", "editor")[0].status).toBe("deferred")
  })
  it("deduplicates lexeme hypotheses without promoting words or resetting decisions", () => {
    const db = fixture(); const first = defer(db, "1", "editor", true); defer(db, "2", "other", true)
    expect(db.prepare("SELECT id FROM CorpusCandidateProposal").all()).toHaveLength(1)
    const p = db.prepare("SELECT * FROM CorpusCandidateProposal").get() as { id: number; ruleSource: string; guessedStem: string; status: string }
    expect(p).toMatchObject({ ruleSource: "editor_workbench", guessedStem: "", status: "pending" })
    db.prepare("UPDATE CorpusCandidateProposal SET status='rejected' WHERE id=?").run(p.id)
    defer(db, "3", "third", true)
    expect(taskList(db, "doc", "editor")[0]).toMatchObject({ proposalKey: first.proposalKey, status: "ready", proposalStatus: "rejected" })
    expect(db.prepare("SELECT id FROM CorpusCandidateProposal").all()).toHaveLength(1)
  })
  it("lets the editor defer again after acknowledging a processed proposal", () => {
    const db = fixture(); const task = defer(db, "1", "editor", true)
    db.exec("UPDATE CorpusCandidateProposal SET status='rejected'")
    expect(taskList(db, "doc", "editor")[0].status).toBe("ready")
    deferTask(db, "doc", "editor", { tokenId: "1", revision: tokenDetail(db, "doc", "1")!.revision, taskVersion: task.version, reason: "consultation", note: "Запросить мнение лингвиста" })
    expect(taskList(db, "doc", "editor")[0].status).toBe("deferred")
  })
  it("bounds a user's document queue and permits another task after closing one", () => {
    const db = fixture(); const first = defer(db)
    db.exec(`WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v+1 FROM n WHERE v<499)
      INSERT INTO corpus_review_tasks(id,userId,documentSlug,tokenId,tokenIndex,surfaceForm,sentenceText,ordinal,reason,note,tokenRevision,tokenStamp,state,version,proposalKey,proposalSeenStatus,completedByEditId,createdAt,updatedAt)
      SELECT 'extra-'||n.v,r.userId,r.documentSlug,CAST(200+n.v AS TEXT),r.tokenIndex,r.surfaceForm,r.sentenceText,r.ordinal,r.reason,r.note,r.tokenRevision,r.tokenStamp,r.state,r.version,r.proposalKey,r.proposalSeenStatus,r.completedByEditId,r.createdAt,r.updatedAt FROM n CROSS JOIN corpus_review_tasks r WHERE r.id='${first.id}'`)
    expect(taskList(db, "doc", "editor")).toHaveLength(500)
    expect(() => defer(db, "2")).toThrow("500")
    closeTask(db, "doc", "editor", first.id, first.version)
    expect(() => defer(db, "2")).not.toThrow()
  })
  it("detects token replacement instead of opening an unrelated occurrence", () => {
    const db = fixture(); defer(db)
    db.exec("UPDATE CorpusToken SET surfaceForm='other' WHERE id=1")
    expect(taskList(db, "doc", "editor")[0].status).toBe("conflict")
  })
  it("rolls back hypothesis and task together on a failing write", () => {
    const db = fixture()
    db.exec("CREATE TRIGGER fail_task BEFORE INSERT ON corpus_review_tasks BEGIN SELECT RAISE(ABORT,'task failed'); END")
    expect(() => defer(db, "1", "editor", true)).toThrow("task failed")
    expect(db.prepare("SELECT id FROM CorpusCandidateProposal").all()).toEqual([])
  })
  it("preserves personal tasks and unreviewed proposals across snapshots and remaps examples", () => {
    const db = fixture(); defer(db, "1", "editor", true)
    const data = exportManual(db, "prod")
    const fingerprint = data.counts.workbenchWorkflow
    expect(data.workbenchWorkflow?.proposals).toHaveLength(1)
    const target = fixture(4, 100)
    importManual(target, data)
    const tasks = taskList(target, "doc", "editor")
    expect(tasks[0]).toMatchObject({ tokenId: "101", reason: "missing_lexeme", status: "ready", proposalStatus: "pending" })
    expect(target.prepare("SELECT exampleTokenIds FROM CorpusCandidateProposal").get()).toEqual({ exampleTokenIds: '["101"]' })
    importManual(target, data)
    expect(taskList(target, "doc", "editor")).toHaveLength(1)
    closeTask(db, "doc", "editor", data.workbenchWorkflow!.tasks[0].id, data.workbenchWorkflow!.tasks[0].version)
    expect(countManual(db).workbenchWorkflow).not.toBe(fingerprint)
  })
  it("retains unmatched tasks as conflicts without trusting reused ids", () => {
    const db = fixture(); defer(db)
    const target = fixture(); target.exec("UPDATE CorpusSentence SET rawText='A different sentence' WHERE id='s1'")
    importManual(target, exportManual(db, "prod"))
    expect(taskList(target, "doc", "editor")[0].status).toBe("conflict")
  })
})
