import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { decodeSlugParam } from "@/lib/slug"
import { withHomonymReviewDb } from "@/lib/corpus/homonymReview"
import { assistance, acceptRecommendation, taskList, deferTask, closeTask, type DeferInput } from "@/lib/corpus/workbenchAutomation"
import { DEFER_REASONS } from "@/lib/corpus/workbenchTaskTypes"
import { validTokenId, WorkbenchConflict, WorkbenchInputError } from "@/lib/corpus/workbench"

type Context = { params: Promise<{ slug: string }> }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9-]{36}$/.test(v)
const revision = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v)
function failed(error: unknown) {
  if (error instanceof WorkbenchConflict) return json({ error: error.message }, 409)
  if (error instanceof WorkbenchInputError || error instanceof SyntaxError) return json({ error: error instanceof SyntaxError ? "Некорректный JSON" : error.message }, 400)
  throw error
}
export async function GET(request: NextRequest, context: Context) {
  const session = await auth()
  if (!session?.user?.id || !await checkPermission(session, Feature.CorpusTokenDisambiguate)) return json({ error: "Unauthorized" }, 403)
  const userId = session.user.id
  const slug = decodeSlugParam((await context.params).slug)
  const p = request.nextUrl.searchParams
  try {
    if (p.get("view") === "tasks") {
      const token = p.get("token")
      if (token && !validTokenId(token)) throw new WorkbenchInputError("Некорректный токен")
      const result = withHomonymReviewDb((db) => db.transaction(() => {
        const current = token ? db.prepare("SELECT version FROM corpus_review_tasks WHERE userId = ? AND documentSlug = ? AND tokenId = ?").get(userId, slug, token) as { version: string } | undefined : undefined
        return { tasks: taskList(db, slug, userId), currentTaskVersion: current?.version ?? null }
      })())
      return json({ ...result, canPropose: await checkPermission(session, Feature.CorpusCandidatesReview) })
    }
    const id = p.get("token")
    const cursor = p.get("cursor") || undefined
    if (!validTokenId(id) || (cursor && !validTokenId(cursor))) throw new WorkbenchInputError("Некорректный токен или курсор")
    return json(withHomonymReviewDb((db) => assistance(db, slug, id, cursor)))
  } catch (error) { return failed(error) }
}
export async function POST(request: NextRequest, context: Context) {
  const session = await auth()
  if (!session?.user?.id || !await checkPermission(session, Feature.CorpusTokenDisambiguate)) return json({ error: "Unauthorized" }, 403)
  const userId = session.user.id
  const slug = decodeSlugParam((await context.params).slug)
  const raw = await request.text()
  if (raw.length > 12000) return json({ error: "Слишком большой запрос" }, 413)
  try {
    const b: unknown = JSON.parse(raw)
    if (!b || typeof b !== "object" || !("action" in b)) throw new WorkbenchInputError("Нужно действие")
    if (b.action === "close") {
      if (!("taskId" in b) || !uuid(b.taskId) || !("version" in b) || !uuid(b.version)) throw new WorkbenchInputError("Нужны задача и версия")
      const { taskId, version } = b
      withHomonymReviewDb((db) => closeTask(db, slug, userId, taskId, version))
      return json({ ok: true })
    }
    if (!("tokenId" in b) || !validTokenId(b.tokenId) || !("revision" in b) || !revision(b.revision)) throw new WorkbenchInputError("Нужны токен и текущая версия")
    const { tokenId, revision: tokenRevision } = b
    if (b.action === "accept") {
      if (!("recommendationRevision" in b) || !revision(b.recommendationRevision) || !("candidateId" in b) || typeof b.candidateId !== "number" || !Number.isSafeInteger(b.candidateId) || b.candidateId < 1) throw new WorkbenchInputError("Нужна актуальная рекомендация")
      const { recommendationRevision, candidateId } = b
      return json(withHomonymReviewDb((db) => acceptRecommendation(db, { slug, tokenId, revision: tokenRevision, recommendationRevision, candidateId, user: { id: userId, email: session.user.email } })))
    }
    if (b.action !== "defer" || !("taskVersion" in b) || (b.taskVersion !== null && !uuid(b.taskVersion)) || !("reason" in b) || typeof b.reason !== "string" || !Object.hasOwn(DEFER_REASONS, b.reason) || !("note" in b) || typeof b.note !== "string" || b.note.length > 2000) throw new WorkbenchInputError("Укажите причину, комментарий и версию задачи")
    let proposal: DeferInput["proposal"]
    if ("proposal" in b) {
      if (!await checkPermission(session, Feature.CorpusCandidatesReview)) return json({ error: "Для заявки нужно право на очередь кандидатов корпуса" }, 403)
      if (!b.proposal || typeof b.proposal !== "object" || !("value" in b.proposal) || typeof b.proposal.value !== "string" || !("pos" in b.proposal) || typeof b.proposal.pos !== "string") throw new WorkbenchInputError("Укажите словарную форму и часть речи")
      proposal = { value: b.proposal.value, pos: b.proposal.pos }
    }
    const input: DeferInput = { tokenId, revision: tokenRevision, taskVersion: b.taskVersion, reason: b.reason as DeferInput["reason"], note: b.note, proposal }
    return json(withHomonymReviewDb((db) => deferTask(db, slug, userId, input)))
  } catch (error) { return failed(error) }
}
