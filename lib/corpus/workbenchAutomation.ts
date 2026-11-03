import { createHash, randomUUID } from "node:crypto"
import type Database from "better-sqlite3"
import { normalizeSurfaceForm } from "./surfaceForm"
import { getExpectedCasesForPreposition } from "./syntax/government"
import { normalizeCase } from "./syntax/caseUtils"
import { tokenDetail, saveTokenEdit, WorkbenchConflict, WorkbenchInputError, validFeats, type TokenDetail, type WorkbenchCandidate } from "./workbench"
import { DEFER_REASONS, type DeferReason, type ReviewTask, type ReviewTaskRecord } from "./workbenchTaskTypes"

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex")
export interface Recommendation {
  candidateId: number; revision: string; reasons: string[]; kind: "reviewed" | "context" | "analyzer"
}
export interface SimilarOccurrence {
  id: string; surfaceForm: string; tokenIndex: number; sentence: string
  highlight: TokenDetail["highlight"]; sameContext: boolean
}
export interface Assistance {
  tokenRevision: string; recommendation: Recommendation | null
  similar: SimilarOccurrence[]; nextCursor: string | null
}
function features(raw: string | null): Record<string, string> | null {
  try { const parsed: unknown = JSON.parse(raw || "{}"); return validFeats(parsed) ? parsed : null } catch { return null }
}
const featureKey = (raw: string | null) => {
  const f = features(raw)
  return f ? JSON.stringify(Object.entries(f).sort(([a], [b]) => a.localeCompare(b))) : null
}
function alignment(state: Pick<TokenDetail, "token" | "sentence" | "alignment">) {
  let offset = 0
  for (const item of state.alignment) {
    const start = state.sentence.rawText.indexOf(item.surfaceForm, offset)
    if (start < 0) return null
    offset = start + item.surfaceForm.length
    if (item.id === state.token.id) return { before: state.sentence.rawText.slice(0, start), word: item.surfaceForm, after: state.sentence.rawText.slice(offset) }
  }
  return null
}
/** Exact local text pattern is only a retrieval hint, never proof of meaning. */
export function contextPattern(state: Pick<TokenDetail, "token" | "sentence" | "alignment">): string | null {
  const h = alignment(state)
  if (!h) return null
  const words = (s: string) => (s.normalize("NFC").toLowerCase().match(/[\p{L}\p{M}\p{N}_]+/gu) || [])
  return digest([state.token.surfaceForm.normalize("NFC").toLowerCase(), words(h.before).slice(-2), words(h.after).slice(0, 2)])
}
export function recommend(db: Database.Database, detail: TokenDetail): Recommendation | null {
  if (detail.token.resolutionSource === "manual" || !detail.candidates.length) return null
  const pattern = contextPattern(detail)
  const verified: { wordSlug: string; feats: string; flavor: string; editId: string; revision: string }[] = []
  if (pattern) {
    // Bound work independently of corpus size. Older decisions remain in history.
    const entries = db.prepare(`SELECT id, afterState FROM corpus_token_edits WHERE documentSlug = ? AND state = 'active'
      ORDER BY createdAt DESC, id DESC LIMIT 20`).all(detail.token.documentSlug) as { id: string; afterState: string }[]
    for (const entry of entries) {
      try {
        const old = JSON.parse(entry.afterState) as TokenDetail
        if (old.token.id === detail.token.id || old.token.surfaceForm !== detail.token.surfaceForm || contextPattern(old) !== pattern) continue
        const now = tokenDetail(db, detail.token.documentSlug, old.token.id)
        if (!now) continue
        const { revision, highlight, ...snapshot } = now
        void highlight
        if (JSON.stringify(snapshot) !== entry.afterState || !now.token.wordSlug) continue
        const feats = featureKey(now.token.feats)
        const chosen = now.candidates.find((c) => c.rank === 0 && c.source === "manual" && c.wordSlug === now.token.wordSlug && featureKey(c.feats) === feats)
        if (feats && chosen) verified.push({ wordSlug: now.token.wordSlug, feats, flavor: chosen.flavor || "CORE", editId: entry.id, revision })
      } catch { /* Corrupt/obsolete evidence must never become a recommendation. */ }
    }
  }
  const make = (candidate: WorkbenchCandidate, kind: Recommendation["kind"], reasons: string[], evidence: unknown = null): Recommendation => ({
    candidateId: candidate.id, kind, reasons, revision: digest([detail.revision, candidate.id, kind, reasons, evidence]),
  })
  if (verified.length) {
    const distinct = new Set(verified.map((v) => JSON.stringify([v.wordSlug, v.feats, v.flavor])))
    // Disagreement between actual reviewed decisions is not resolved by frequency.
    if (distinct.size > 1) return null
    const found = detail.candidates.find((c) => c.wordSlug === verified[0].wordSlug && featureKey(c.feats) === verified[0].feats && (c.flavor || "CORE") === verified[0].flavor)
    if (found) return make(found, "reviewed", ["Такой разбор подтверждён редактором для этой формы с теми же ближайшими словами (до двух с каждой стороны).", "Лексема, граммемы и региональный вариант совпадают с кандидатом именно этого вхождения. Проверьте полный контекст."], verified)
  }
  if (detail.token.isPartialMatch || detail.token.matchCount === 0) return null
  const h = detail.highlight
  const preceding = h?.before.match(/([\p{L}\p{M}\p{N}_]+)\s+$/u)?.[1]
  if (preceding) {
    const expected = getExpectedCasesForPreposition(preceding)
    const fitting = detail.candidates.filter((c) => {
      const value = features(c.feats)?.case
      return !!value && expected.some((e) => e === normalizeCase(value))
    })
    if (expected.length && fitting.length === 1) return make(fitting[0], "context", [`Перед словом стоит «${preceding}»; из текущих кандидатов только этот имеет падеж ${expected.join(" / ")} из существующего справочника управления предлогов.`, "Это подсказка по соседнему слову, а не проверка всей синтаксической конструкции."])
  }
  if (detail.candidates.length === 1) return make(detail.candidates[0], "analyzer", ["У анализатора есть единственный точный разбор этой формы. Значение и граммемы требуют вашего подтверждения."])
  const ranked = detail.candidates.slice().sort((a, b) => b.score - a.score)
  if (ranked.every((c) => Number.isFinite(c.score)) && ranked[0].score > ranked[1].score) return make(ranked[0], "analyzer", ["Этот вариант имеет наибольший сохранённый рейтинг анализатора среди текущих кандидатов.", "Рейтинг не является вероятностью правильности; прочитайте контекст перед подтверждением."])
  return null
}
export function assistance(db: Database.Database, slug: string, tokenId: string, cursor?: string): Assistance {
  return db.transaction(() => {
    const detail = tokenDetail(db, slug, tokenId)
    if (!detail) throw new WorkbenchInputError("Токен не найден")
    const anchor = cursor ? db.prepare("SELECT tokenIndex FROM CorpusToken WHERE id = ? AND documentSlug = ? AND surfaceForm = ?").get(cursor, slug, detail.token.surfaceForm) as { tokenIndex: number } | undefined : undefined
    if (cursor && !anchor) throw new WorkbenchConflict("Подборка изменилась. Откройте её заново.")
    const args: (string | number)[] = [slug, detail.token.surfaceForm, tokenId]
    if (anchor) args.push(anchor.tokenIndex, cursor!)
    const rows = db.prepare(`SELECT CAST(id AS TEXT) id FROM CorpusToken WHERE documentSlug = ? AND surfaceForm = ? AND id != ?
      AND wordIndex != -1 AND resolutionSource = 'auto' AND (matchCount != 1 OR isPartialMatch = 1 OR homonymGroupKey IS NOT NULL)
      ${anchor ? "AND (tokenIndex, id) > (?, CAST(? AS INTEGER))" : ""} ORDER BY tokenIndex, id LIMIT 21`).all(...args) as { id: string }[]
    const pattern = contextPattern(detail)
    const similar = rows.slice(0, 20).flatMap(({ id }): SimilarOccurrence[] => {
      const other = tokenDetail(db, slug, id)
      if (!other) return []
      const h = other.highlight
      return [{ id, surfaceForm: other.token.surfaceForm, tokenIndex: other.token.tokenIndex,
        sentence: other.sentence.rawText.slice(0, 600), highlight: h ? { before: h.before.slice(-200), word: h.word.slice(0, 200), after: h.after.slice(0, 200) } : null,
        sameContext: !!pattern && contextPattern(other) === pattern }]
    })
    return { tokenRevision: detail.revision, recommendation: recommend(db, detail), similar, nextCursor: rows.length > 20 ? rows[19].id : null }
  })()
}
export function acceptRecommendation(db: Database.Database, input: { slug: string; tokenId: string; revision: string; recommendationRevision: string; candidateId: number; user: { id: string; email?: string | null } }) {
  return db.transaction(() => {
    const detail = tokenDetail(db, input.slug, input.tokenId)
    if (!detail || detail.revision !== input.revision) throw new WorkbenchConflict("Токен или контекст изменился. Загрузите свежую версию.")
    const current = recommend(db, detail)
    if (!current || current.revision !== input.recommendationRevision || current.candidateId !== input.candidateId) throw new WorkbenchConflict("Рекомендация или подтверждающий её пример изменились. Проверьте новую подсказку.")
    return saveTokenEdit(db, { ...input, selection: { candidateId: current.candidateId } })
  }).immediate()
}

export function taskList(db: Database.Database, slug: string, userId: string): ReviewTask[] {
  return db.prepare(`SELECT r.id,r.documentSlug,r.tokenId,r.tokenIndex,r.surfaceForm,r.reason,r.note,r.version,r.proposalKey,r.createdAt,r.updatedAt, p.id proposalId, p.status proposalStatus,
    CASE WHEN r.state = 'closed' THEN 'closed' WHEN r.state = 'conflict' OR t.id IS NULL OR t.documentSlug != r.documentSlug OR t.surfaceForm != r.surfaceForm OR t.tokenIndex != r.tokenIndex OR substr(s.rawText, 1, 16000) != r.sentenceText THEN 'conflict'
      WHEN t.workbenchRevision != r.tokenStamp OR t.resolutionSource = 'manual' OR (r.proposalKey IS NOT NULL AND COALESCE(p.status, 'missing') != COALESCE(r.proposalSeenStatus, 'missing')) THEN 'ready' ELSE 'deferred' END status
    FROM corpus_review_tasks r LEFT JOIN CorpusToken t ON t.id = CAST(r.tokenId AS INTEGER)
    LEFT JOIN CorpusSentence s ON s.id = t.sentenceId
    LEFT JOIN CorpusCandidateProposal p ON p.ruleSource = 'editor_workbench' AND p.guessedStemType = '' AND p.guessedGrammeme = r.proposalKey
    WHERE r.documentSlug = ? AND r.userId = ? AND r.state != 'closed' ORDER BY r.updatedAt DESC, r.id LIMIT 500`).all(slug, userId) as ReviewTask[]
}
export interface DeferInput {
  tokenId: string; revision: string; taskVersion: string | null; reason: DeferReason; note: string
  proposal?: { value: string; pos: string }
}
export function deferTask(db: Database.Database, slug: string, userId: string, input: DeferInput): ReviewTaskRecord {
  return db.transaction(() => {
    const d = tokenDetail(db, slug, input.tokenId)
    if (!d || d.revision !== input.revision) throw new WorkbenchConflict("Токен или контекст изменился. Загрузите свежую версию перед откладыванием.")
    if (!Object.hasOwn(DEFER_REASONS, input.reason) || input.note.length > 2000) throw new WorkbenchInputError("Некорректная причина или комментарий")
    const old = db.prepare("SELECT * FROM corpus_review_tasks WHERE userId = ? AND documentSlug = ? AND tokenId = ?").get(userId, slug, input.tokenId) as ReviewTaskRecord | undefined
    if ((old?.version ?? null) !== input.taskVersion) throw new WorkbenchConflict("Задача изменена в другой вкладке. Обновите список.")
    const count = db.prepare("SELECT COUNT(*) n FROM corpus_review_tasks WHERE userId = ? AND documentSlug = ? AND state != 'closed'").get(userId, slug) as { n: number }
    if ((!old || old.state === "closed") && count.n >= 500) throw new WorkbenchInputError("В документе уже отложено 500 задач. Закройте часть перед добавлением новых.")
    const ordinal = db.prepare("SELECT COUNT(*) n FROM CorpusToken WHERE sentenceId = ? AND surfaceForm = ? AND tokenIndex < ?").get(d.token.sentenceId, d.token.surfaceForm, d.token.tokenIndex) as { n: number }
    let proposalKey = old?.proposalKey ?? null
    const time = new Date().toISOString()
    if (input.proposal) {
      const value = input.proposal.value.trim()
      if (input.reason !== "missing_lexeme" || !value || value.length > 250 || !["NOUN", "ADJ", "VERB", "ADV", "PRON", "NUM", "ADP", "CCONJ", "SCONJ", "PART", "INTJ"].includes(input.proposal.pos)) throw new WorkbenchInputError("Укажите словарную форму и часть речи для гипотезы")
      const cluster = normalizeSurfaceForm(d.token.surfaceForm)
      proposalKey = digest([cluster, value.normalize("NFC"), input.proposal.pos])
      const existing = db.prepare("SELECT id FROM CorpusCandidateProposal WHERE clusterKey = ? AND ruleSource = 'editor_workbench' AND guessedStemType = '' AND guessedGrammeme = ?").get(cluster, proposalKey)
      if (!existing) {
        const pending = db.prepare("SELECT COUNT(*) n FROM CorpusCandidateProposal WHERE clusterKey=? AND ruleSource='editor_workbench' AND status='pending'").get(cluster) as { n: number }
        if (pending.n >= 20) throw new WorkbenchInputError("Для этой формы уже подготовлено 20 гипотез. Сначала разберите их в очереди кандидатов.")
      }
      if (!existing) db.prepare(`INSERT INTO CorpusCandidateProposal (clusterKey, ruleSource, guessedPos, guessedStemType, guessedGrammeme, guessedStem, reconstructedForm, rank, occurrenceCount, exampleTokenIds, firstSeenAt, lastSeenAt, status)
        VALUES (?, 'editor_workbench', ?, '', ?, '', ?, 0, 1, ?, ?, ?, 'pending')`).run(cluster, input.proposal.pos, proposalKey, value, JSON.stringify([input.tokenId]), time, time)
      // Existing editorial decisions, including rejected ones, are never reset.
    }
    const proposalState = proposalKey ? db.prepare("SELECT status FROM CorpusCandidateProposal WHERE ruleSource='editor_workbench' AND guessedStemType='' AND guessedGrammeme=?").get(proposalKey) as { status: string } | undefined : undefined
    const row: ReviewTaskRecord = { id: old?.id || randomUUID(), userId, documentSlug: slug, tokenId: input.tokenId,
      tokenIndex: d.token.tokenIndex, surfaceForm: d.token.surfaceForm, sentenceText: d.sentence.rawText, ordinal: ordinal.n,
      reason: input.reason, note: input.note, tokenRevision: d.revision, tokenStamp: d.token.workbenchRevision,
      state: "deferred", version: randomUUID(), proposalKey, proposalSeenStatus: proposalState?.status ?? null, completedByEditId: null, createdAt: old?.createdAt || time, updatedAt: time }
    db.prepare(`INSERT INTO corpus_review_tasks (id,userId,documentSlug,tokenId,tokenIndex,surfaceForm,sentenceText,ordinal,reason,note,tokenRevision,tokenStamp,state,version,proposalKey,proposalSeenStatus,completedByEditId,createdAt,updatedAt)
      VALUES (@id,@userId,@documentSlug,@tokenId,@tokenIndex,@surfaceForm,@sentenceText,@ordinal,@reason,@note,@tokenRevision,@tokenStamp,@state,@version,@proposalKey,@proposalSeenStatus,@completedByEditId,@createdAt,@updatedAt)
      ON CONFLICT(userId,documentSlug,tokenId) DO UPDATE SET tokenIndex=excluded.tokenIndex,surfaceForm=excluded.surfaceForm,sentenceText=excluded.sentenceText,ordinal=excluded.ordinal,reason=excluded.reason,note=excluded.note,tokenRevision=excluded.tokenRevision,tokenStamp=excluded.tokenStamp,state=excluded.state,version=excluded.version,proposalKey=excluded.proposalKey,proposalSeenStatus=excluded.proposalSeenStatus,completedByEditId=NULL,updatedAt=excluded.updatedAt`).run(row)
    return row
  }).immediate()
}
export function closeTask(db: Database.Database, slug: string, userId: string, id: string, version: string) {
  const result = db.prepare("UPDATE corpus_review_tasks SET state = 'closed', completedByEditId = NULL, version = ?, updatedAt = ? WHERE id = ? AND userId = ? AND documentSlug = ? AND version = ?").run(randomUUID(), new Date().toISOString(), id, userId, slug, version)
  if (!result.changes) throw new WorkbenchConflict("Задача изменена или недоступна. Обновите список.")
}
