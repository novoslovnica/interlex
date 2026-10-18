import { createHash, randomUUID } from "node:crypto"
import Database from "better-sqlite3"

export const MAX_REVIEW_TOKENS = 50
export interface ReviewedToken { tokenId: string; revision: string }
interface CandidateState {
  id: number; wordSlug: string; lemma: string; pos: string; feats: string | null
  flavor: string | null; score: number; source: string; rank: number
}
interface TokenState {
  id: string; documentSlug: string; sentenceId: string; tokenIndex: number
  surfaceForm: string; sentence: string; wordSlug: string | null; lemma: string
  pos: string; feats: string | null; matchCount: number; isPartialMatch: number
  resolutionSource: string; homonymGroupKey: string | null
}
interface Snapshot { token: TokenState; candidates: CandidateState[] }
export interface ReviewContext {
  tokenId: string; revision: string; surfaceForm: string; sentence: string
  documentSlug: string; documentTitle: string; tokenIndex: number
  highlight: { before: string; word: string; after: string } | null
}
export interface ReviewBatch {
  id: string; groupKey: string; wordSlug: string; userId: string | null
  userEmail: string | null; createdAt: string; undoneAt: string | null
  total: number; active: number; conflicts: number; restored: number
}
export class HomonymReviewConflict extends Error {}

/** A short-lived, synchronous connection: at most 50 reviewed occurrences per transaction. */
export function withHomonymReviewDb<T>(run: (db: Database.Database) => T): T {
  const url = process.env.CORPUS_DATABASE_URL
  const dbPath = process.env.CORPUS_SQLITE_DB || (url?.startsWith("file:") ? url.slice(5) : "corpus.db")
  const db = new Database(dbPath, { fileMustExist: true, timeout: 5000 })
  try { return run(db) } finally { db.close() }
}

function snapshot(db: Database.Database, tokenId: string): Snapshot | null {
  const token = db.prepare(`
    SELECT CAST(t.id AS TEXT) AS id, t.documentSlug, t.sentenceId, t.tokenIndex,
      t.surfaceForm, s.rawText AS sentence, t.wordSlug, t.lemma, t.pos, t.feats,
      t.matchCount, t.isPartialMatch, t.resolutionSource, t.homonymGroupKey
    FROM CorpusToken t JOIN CorpusSentence s ON s.id = t.sentenceId WHERE t.id = ?
  `).get(tokenId) as TokenState | undefined
  if (!token) return null
  const candidates = db.prepare(`SELECT id, wordSlug, lemma, pos, feats, flavor, score, source, rank
    FROM CorpusTokenCandidate WHERE tokenId = ? ORDER BY id`).all(tokenId) as CandidateState[]
  return { token, candidates }
}
function revision(state: Snapshot): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex")
}

export function fetchReviewContexts(db: Database.Database, groupKey: string, after = "0") {
  if (!/^\d+$/.test(after)) throw new Error("Invalid cursor")
  const rows = db.prepare(`SELECT CAST(t.id AS TEXT) AS id, d.title AS documentTitle
    FROM CorpusToken t JOIN CorpusDocument d ON d.slug = t.documentSlug
    WHERE t.homonymGroupKey = ? AND t.resolutionSource = 'auto' AND t.id > CAST(? AS INTEGER)
    ORDER BY t.id LIMIT ?`).all(groupKey, after, MAX_REVIEW_TOKENS + 1) as { id: string; documentTitle: string }[]
  // Read context and revision in the same SQLite read transaction.
  const contexts: ReviewContext[] = rows.slice(0, MAX_REVIEW_TOKENS).map((row) => {
    const state = snapshot(db, row.id)!
    const preceding = db.prepare(`SELECT surfaceForm, tokenIndex FROM CorpusToken
      WHERE sentenceId = ? AND tokenIndex <= ? ORDER BY tokenIndex`).all(state.token.sentenceId, state.token.tokenIndex) as { surfaceForm: string; tokenIndex: number }[]
    let cursor = 0
    let highlight: ReviewContext["highlight"] = null
    for (const token of preceding) {
      const start = state.token.sentence.indexOf(token.surfaceForm, cursor)
      if (start < 0) break // Never highlight a guessed occurrence.
      cursor = start + token.surfaceForm.length
      if (token.tokenIndex === state.token.tokenIndex) {
        highlight = { before: state.token.sentence.slice(0, start), word: token.surfaceForm, after: state.token.sentence.slice(cursor) }
      }
    }
    return { tokenId: row.id, revision: revision(state), surfaceForm: state.token.surfaceForm,
      sentence: state.token.sentence, documentSlug: state.token.documentSlug,
      documentTitle: row.documentTitle, tokenIndex: state.token.tokenIndex, highlight }
  })
  return { contexts, nextCursor: rows.length > MAX_REVIEW_TOKENS ? contexts.at(-1)!.tokenId : null }
}

export function isReviewedTokens(value: unknown): value is ReviewedToken[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_REVIEW_TOKENS) return false
  const ids = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== "object" || !("tokenId" in item) || !("revision" in item)
      || typeof item.tokenId !== "string" || !/^[1-9]\d{0,18}$/.test(item.tokenId)
      || BigInt(item.tokenId) > 9223372036854775807n
      || typeof item.revision !== "string" || !/^[a-f0-9]{64}$/.test(item.revision)
      || ids.has(item.tokenId)) return false
    ids.add(item.tokenId)
  }
  return true
}

export function applyHomonymReview(db: Database.Database, input: {
  groupKey: string; wordSlug: string; tokens: ReviewedToken[]
  user: { id?: string | null; email?: string | null }
}) {
  if (!input.groupKey || !input.wordSlug || !isReviewedTokens(input.tokens)) {
    throw new Error("Select 1–50 reviewed occurrences with current revisions")
  }
  return db.transaction(() => {
    // Validate ALL occurrences before changing any of them; stale/mixed selections fail atomically.
    const states = input.tokens.map((item) => {
      const before = snapshot(db, item.tokenId)
      if (!before || before.token.resolutionSource !== "auto"
        || before.token.homonymGroupKey !== input.groupKey || revision(before) !== item.revision) {
        throw new HomonymReviewConflict("Контекст или разбор изменился. Перезагрузите вхождения и проверьте выбор.")
      }
      const winner = before.candidates.filter((c) => c.wordSlug === input.wordSlug)
        .sort((a, b) => a.rank - b.rank || a.id - b.id)[0]
      if (!winner) throw new HomonymReviewConflict("Выбранная лексема отсутствует среди кандидатов одного из вхождений.")
      return { before, winner }
    })
    const batchId = randomUUID()
    db.prepare(`INSERT INTO corpus_homonym_batches (id, groupKey, wordSlug, userId, userEmail, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)`).run(batchId, input.groupKey, input.wordSlug,
        input.user.id ?? null, input.user.email ?? null, new Date().toISOString())
    for (const { before, winner } of states) {
      const id = before.token.id
      let rank = 1
      for (const candidate of before.candidates.slice().sort((a, b) => a.rank - b.rank || a.id - b.id)) {
        db.prepare(`UPDATE CorpusTokenCandidate SET rank = ?, source = ? WHERE id = ?`)
          .run(candidate.id === winner.id ? 0 : rank++, candidate.id === winner.id ? "manual" : candidate.source, candidate.id)
      }
      db.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = ?, pos = ?, feats = ?, matchCount = 1,
        resolutionSource = 'manual', homonymGroupKey = NULL WHERE id = ?`)
        .run(winner.wordSlug, winner.lemma, winner.pos, winner.feats, id)
      const after = snapshot(db, id)!
      // Insert AFTER writes: later edits invalidate this entry through DB triggers,
      // including point resolution, imports and raw SQL (even identical values).
      db.prepare(`INSERT INTO corpus_homonym_batch_entries (batchId, tokenId, beforeState, afterState)
        VALUES (?, ?, ?, ?)`).run(batchId, id, JSON.stringify(before), JSON.stringify(after))
    }
    return { batchId, resolvedTokens: states.length }
  }).immediate()
}

export function undoHomonymReview(db: Database.Database, batchId: string, undoneBy: string) {
  return db.transaction(() => {
    const batch = db.prepare(`SELECT id FROM corpus_homonym_batches WHERE id = ?`).get(batchId)
    if (!batch) return null
    const entries = db.prepare(`SELECT tokenId, beforeState, afterState FROM corpus_homonym_batch_entries
      WHERE batchId = ? AND state = 'active'`).all(batchId) as { tokenId: string; beforeState: string; afterState: string }[]
    let restored = 0
    for (const entry of entries) {
      const current = snapshot(db, entry.tokenId)
      if (!current || JSON.stringify(current) !== entry.afterState) {
        db.prepare(`UPDATE corpus_homonym_batch_entries SET state = 'conflict' WHERE batchId = ? AND tokenId = ?`)
          .run(batchId, entry.tokenId)
        continue
      }
      const before = JSON.parse(entry.beforeState) as Snapshot
      const t = before.token
      // Retire entry before restoring, so our conflict guards don't invalidate it.
      db.prepare(`UPDATE corpus_homonym_batch_entries SET state = 'undone' WHERE batchId = ? AND tokenId = ?`)
        .run(batchId, entry.tokenId)
      db.prepare(`UPDATE CorpusToken SET wordSlug = ?, lemma = ?, pos = ?, feats = ?, matchCount = ?,
        isPartialMatch = ?, resolutionSource = ?, homonymGroupKey = ? WHERE id = ?`)
        .run(t.wordSlug, t.lemma, t.pos, t.feats, t.matchCount, t.isPartialMatch, t.resolutionSource, t.homonymGroupKey, t.id)
      for (const c of before.candidates) {
        db.prepare(`UPDATE CorpusTokenCandidate SET rank = ?, source = ? WHERE id = ?`).run(c.rank, c.source, c.id)
      }
      restored++
    }
    db.prepare(`UPDATE corpus_homonym_batches SET undoneAt = COALESCE(undoneAt, ?), undoneBy = COALESCE(undoneBy, ?) WHERE id = ?`)
      .run(new Date().toISOString(), undoneBy, batchId)
    const { conflicts } = db.prepare(`SELECT COUNT(*) AS conflicts FROM corpus_homonym_batch_entries
      WHERE batchId = ? AND state = 'conflict'`).get(batchId) as { conflicts: number }
    return { restored, conflicts }
  }).immediate()
}

export function fetchReviewBatches(db: Database.Database, offset = 0, limit = 20): ReviewBatch[] {
  return db.prepare(`SELECT b.id, b.groupKey, b.wordSlug, b.userId, b.userEmail, b.createdAt, b.undoneAt,
    COUNT(*) AS total, SUM(e.state = 'active') AS active, SUM(e.state = 'conflict') AS conflicts,
    SUM(e.state = 'undone') AS restored
    FROM (SELECT * FROM corpus_homonym_batches ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?) b
    JOIN corpus_homonym_batch_entries e ON e.batchId = b.id
    GROUP BY b.id ORDER BY b.createdAt DESC, b.id DESC`).all(limit, offset) as ReviewBatch[]
}
