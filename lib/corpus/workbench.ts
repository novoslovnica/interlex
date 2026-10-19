import { createHash, randomUUID } from "node:crypto"
import type Database from "better-sqlite3"

export type QueueFilter = "problems" | "all" | "manual"
export interface QueueToken { id: string; tokenIndex: number; surfaceForm: string; lemma: string; pos: string; resolutionSource: string; matchCount: number; isPartialMatch: number }
interface StoredToken extends QueueToken {
  documentSlug: string; sentenceId: string; wordIndex: number; wordSlug: string | null
  feats: string | null; homonymGroupKey: string | null; workbenchRevision: string
}
export interface WorkbenchCandidate {
  id: number; wordSlug: string; lemma: string; pos: string; feats: string | null
  flavor: string | null; score: number; source: string; rank: number
}
interface Snapshot {
  token: StoredToken
  candidates: WorkbenchCandidate[]
  sentence: { id: string; rawText: string; segmentId: string; position: number }
  context: { id: string; position: number; rawText: string }[]
  alignment: { id: string; surfaceForm: string }[]
}
export interface TokenDetail extends Snapshot { revision: string; highlight: { before: string; word: string; after: string } | null }
export interface TokenEdit {
  id: string; tokenId: string; documentSlug: string; createdAt: string; userEmail: string | null
  state: "active" | "conflict" | "undone"; undoneAt: string | null
  surfaceForm: string; wordSlug: string | null
}
export class WorkbenchConflict extends Error {}
export class WorkbenchInputError extends Error {}
export const validTokenId = (v: unknown): v is string => typeof v === "string" && /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n
export function validFeats(value: unknown): value is Record<string, string> {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length <= 40 && Object.entries(value).every(([k, v]) => k.length > 0 && k.length <= 80 && typeof v === "string" && v.length <= 160)
}
export type SaveSelection = { candidateId: number } | { wordSlug: string; feats: Record<string, string> }
export function parseSelection(body: unknown): SaveSelection {
  if (!body || typeof body !== "object") throw new WorkbenchInputError("Выберите разбор")
  if ("candidateId" in body && "wordSlug" in body) throw new WorkbenchInputError("Выберите один способ разметки")
  if ("candidateId" in body && typeof body.candidateId === "number" && Number.isSafeInteger(body.candidateId) && body.candidateId > 0) return { candidateId: body.candidateId }
  if ("wordSlug" in body && typeof body.wordSlug === "string" && body.wordSlug.length > 0 && body.wordSlug.length <= 250 && "feats" in body && validFeats(body.feats)) return { wordSlug: body.wordSlug, feats: body.feats }
  throw new WorkbenchInputError("Нужен кандидат или лексема с граммемами (объект строк)")
}
const tokenColumns = `CAST(t.id AS TEXT) id, t.documentSlug, t.sentenceId, t.tokenIndex, t.wordIndex,
  t.surfaceForm, t.lemma, t.pos, t.wordSlug, t.feats, t.matchCount, t.isPartialMatch,
  t.resolutionSource, t.homonymGroupKey, t.workbenchRevision`
function snapshot(db: Database.Database, slug: string, id: string): Snapshot | null {
  const token = db.prepare(`SELECT ${tokenColumns} FROM CorpusToken t WHERE t.id = ? AND t.documentSlug = ? AND t.wordIndex != -1`).get(id, slug) as StoredToken | undefined
  if (!token) return null
  const sentence = db.prepare(`SELECT id, substr(rawText, 1, 16000) rawText, segmentId, position FROM CorpusSentence WHERE id = ? AND documentSlug = ?`).get(token.sentenceId, slug) as Snapshot["sentence"] | undefined
  if (!sentence) return null
  const segment = db.prepare("SELECT position FROM CorpusSegment WHERE id = ? AND documentSlug = ?").get(sentence.segmentId, slug) as { position: number } | undefined
  if (!segment) return null
  // At most three paragraphs, each bounded; no full-document fetches.
  const context = db.prepare(`SELECT id, position, substr(rawText, 1, 16000) rawText FROM CorpusSegment
    WHERE documentSlug = ? AND position >= ? AND position <= ? ORDER BY position, id LIMIT 3`).all(slug, segment.position - 1, segment.position + 1) as Snapshot["context"]
  const candidates = db.prepare(`SELECT id, wordSlug, lemma, pos, feats, flavor, score, source, rank FROM CorpusTokenCandidate WHERE tokenId = ? ORDER BY id LIMIT 201`).all(id) as WorkbenchCandidate[]
  if (candidates.length > 200) throw new WorkbenchInputError("Слишком много разборов токена; используйте прежний экран")
  const alignment = db.prepare(`SELECT CAST(id AS TEXT) id, surfaceForm FROM CorpusToken
    WHERE sentenceId = ? AND tokenIndex <= ? ORDER BY tokenIndex, id LIMIT 2001`).all(token.sentenceId, token.tokenIndex) as Snapshot["alignment"]
  return { token, candidates, sentence, context, alignment }
}
const revision = (state: Snapshot) => createHash("sha256").update(JSON.stringify(state)).digest("hex")
export function tokenDetail(db: Database.Database, slug: string, id: string): TokenDetail | null {
  return db.transaction(() => {
    const state = snapshot(db, slug, id)
    if (!state) return null
    let cursor = 0
    let highlight: TokenDetail["highlight"] = null
    for (const t of state.alignment) {
      const start = state.sentence.rawText.indexOf(t.surfaceForm, cursor)
      if (start < 0) break
      cursor = start + t.surfaceForm.length
      if (t.id === id) highlight = { before: state.sentence.rawText.slice(0, start), word: t.surfaceForm, after: state.sentence.rawText.slice(cursor) }
    }
    return { ...state, revision: revision(state), highlight }
  })()
}
export function tokenQueue(db: Database.Database, slug: string, filter: QueueFilter, cursor?: string, direction: "after" | "before" | "from" = "after", search = "") {
  return db.transaction(() => {
    const anchor = cursor ? db.prepare("SELECT tokenIndex FROM CorpusToken WHERE id = ? AND documentSlug = ?").get(cursor, slug) as { tokenIndex: number } | undefined : undefined
    if (cursor && !anchor) throw new WorkbenchConflict("Позиция исчезла после переразметки. Откройте очередь заново.")
    const condition = filter === "manual" ? "AND t.resolutionSource = 'manual'" : filter === "problems" ? "AND t.resolutionSource = 'auto' AND (t.matchCount != 1 OR t.isPartialMatch = 1 OR t.homonymGroupKey IS NOT NULL)" : ""
    const sign = direction === "before" ? "<" : direction === "from" ? ">=" : ">"
    const args: (string | number)[] = [slug, search.toLowerCase()]
    if (anchor) args.push(anchor.tokenIndex, cursor!)
    const rows = db.prepare(`SELECT CAST(t.id AS TEXT) id, t.tokenIndex, t.surfaceForm, t.lemma, t.pos, t.resolutionSource, t.matchCount, t.isPartialMatch FROM CorpusToken t
      WHERE t.documentSlug = ? AND t.wordIndex != -1 AND instr(lower(t.surfaceForm), ?) > 0 ${condition}
      ${anchor ? `AND (t.tokenIndex, t.id) ${sign} (?, CAST(? AS INTEGER))` : ""}
      ORDER BY t.tokenIndex ${direction === "before" ? "DESC" : "ASC"}, t.id ${direction === "before" ? "DESC" : "ASC"} LIMIT 51`).all(...args) as QueueToken[]
    const more = rows.length > 50
    return { tokens: rows.slice(0, 50), more }
  })()
}
export function listTokenEdits(db: Database.Database, slug: string, before?: string): TokenEdit[] {
  return db.prepare(`SELECT id, tokenId, documentSlug, userEmail, createdAt, state, undoneAt,
    json_extract(afterState, '$.token.surfaceForm') surfaceForm, json_extract(afterState, '$.token.wordSlug') wordSlug
    FROM corpus_token_edits WHERE documentSlug = ? ${before ? "AND (createdAt, id) < (SELECT createdAt, id FROM corpus_token_edits WHERE id = ? AND documentSlug = ?)" : ""}
    ORDER BY createdAt DESC, id DESC LIMIT 21`).all(...(before ? [slug, before, slug] : [slug])) as TokenEdit[]
}
export function saveTokenEdit(db: Database.Database, input: {
  slug: string; tokenId: string; revision: string; selection: SaveSelection
  manualLexeme?: { slug: string; lemma: string; pos: string }
  user: { id?: string | null; email?: string | null }
}) {
  return db.transaction(() => {
    const before = snapshot(db, input.slug, input.tokenId)
    if (!before || revision(before) !== input.revision) throw new WorkbenchConflict("Токен, кандидаты или контекст изменились. Загрузите свежую версию и проверьте выбор. Черновик сохранён на экране.")
    const selection = input.selection
    let winner: WorkbenchCandidate | undefined
    if ("candidateId" in selection) winner = before.candidates.find((c) => c.id === selection.candidateId)
    else if (input.manualLexeme && input.manualLexeme.slug === selection.wordSlug) {
      const { slug: wordSlug, lemma, pos } = input.manualLexeme
      const feats = JSON.stringify(selection.feats)
      const normalized = (raw: string | null) => {
        try {
          const value: unknown = JSON.parse(raw || "{}")
          return validFeats(value) ? JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : null
        } catch { return null }
      }
      winner = before.candidates.find((c) => c.wordSlug === wordSlug && c.lemma === lemma && c.pos === pos && normalized(c.feats) === normalized(feats))
      if (!winner) {
        const result = db.prepare(`INSERT INTO CorpusTokenCandidate (tokenId, wordSlug, lemma, pos, feats, source, rank, score) VALUES (?, ?, ?, ?, ?, 'manual', 0, 0)`).run(input.tokenId, wordSlug, lemma, pos, feats)
        winner = { id: Number(result.lastInsertRowid), wordSlug, lemma, pos, feats, source: "manual", rank: 0, score: 0, flavor: null }
      }
    }
    if (!winner) throw new WorkbenchInputError("Кандидат не принадлежит этому токену или лексема отсутствует")
    let rank = 1
    for (const c of before.candidates.slice().sort((a, b) => a.rank - b.rank || a.id - b.id)) {
      db.prepare("UPDATE CorpusTokenCandidate SET rank = ?, source = ? WHERE id = ?").run(c.id === winner.id ? 0 : rank++, c.id === winner.id ? "manual" : c.source, c.id)
    }
    db.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = ?, pos = ?, feats = ?, matchCount = 1,
      isPartialMatch = 0, resolutionSource = 'manual', homonymGroupKey = NULL WHERE id = ?`).run(winner.wordSlug, winner.lemma, winner.pos, winner.feats, input.tokenId)
    const after = snapshot(db, input.slug, input.tokenId)!
    const editId = randomUUID()
    db.prepare(`INSERT INTO corpus_token_edits (id, documentSlug, tokenId, userId, userEmail, createdAt, beforeState, afterState) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(editId, input.slug, input.tokenId, input.user.id ?? null, input.user.email ?? null, new Date().toISOString(), JSON.stringify(before), JSON.stringify(after))
    return { editId, token: after.token }
  }).immediate()
}
export function undoTokenEdit(db: Database.Database, slug: string, editId: string, actor: string) {
  return db.transaction(() => {
    const edit = db.prepare("SELECT * FROM corpus_token_edits WHERE id = ? AND documentSlug = ?").get(editId, slug) as { tokenId: string; beforeState: string; afterState: string; state: string } | undefined
    if (!edit) throw new WorkbenchInputError("Правка не найдена")
    if (edit.state === "undone") return { restored: false, conflict: false }
    const current = snapshot(db, slug, edit.tokenId)
    if (edit.state !== "active" || !current || JSON.stringify(current) !== edit.afterState) {
      db.prepare("UPDATE corpus_token_edits SET state = 'conflict' WHERE id = ?").run(editId)
      return { restored: false, conflict: true }
    }
    const before = JSON.parse(edit.beforeState) as Snapshot
    db.prepare("UPDATE corpus_token_edits SET state = 'undone', undoneAt = ?, undoneBy = ? WHERE id = ?").run(new Date().toISOString(), actor, editId)
    const ids = new Set(before.candidates.map((c) => c.id))
    for (const c of current.candidates) if (!ids.has(c.id)) db.prepare("DELETE FROM CorpusTokenCandidate WHERE id = ? AND tokenId = ?").run(c.id, edit.tokenId)
    for (const c of before.candidates) db.prepare("UPDATE CorpusTokenCandidate SET rank = ?, source = ? WHERE id = ? AND tokenId = ?").run(c.rank, c.source, c.id, edit.tokenId)
    const t = before.token
    db.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = ?, pos = ?, feats = ?, matchCount = ?, isPartialMatch = ?, resolutionSource = ?, homonymGroupKey = ? WHERE id = ?`).run(t.wordSlug, t.lemma, t.pos, t.feats, t.matchCount, t.isPartialMatch, t.resolutionSource, t.homonymGroupKey, edit.tokenId)
    return { restored: true, conflict: false }
  }).immediate()
}
