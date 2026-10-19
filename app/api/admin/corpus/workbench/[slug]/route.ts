import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { decodeSlugParam } from "@/lib/slug"
import { prismaData } from "@/lib/prisma"
import { isValidPos } from "@/lib/grammar/common"
import { withHomonymReviewDb } from "@/lib/corpus/homonymReview"
import { listTokenEdits, parseSelection, saveTokenEdit, tokenDetail, tokenQueue, undoTokenEdit, validTokenId, WorkbenchConflict, WorkbenchInputError } from "@/lib/corpus/workbench"

type Context = { params: Promise<{ slug: string }> }
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } })
function errorResponse(error: unknown) {
  if (error instanceof WorkbenchConflict) return json({ error: error.message }, 409)
  if (error instanceof WorkbenchInputError) return json({ error: error.message }, 400)
  throw error
}
export async function GET(request: NextRequest, context: Context) {
  const session = await auth()
  if (!session || !await checkPermission(session, Feature.CorpusTokenDisambiguate)) return json({ error: "Unauthorized" }, 403)
  const slug = decodeSlugParam((await context.params).slug)
  const p = request.nextUrl.searchParams
  try {
    if (p.get("view") === "history") {
      const before = p.get("before") || undefined
      if (before && !/^[a-f0-9-]{36}$/.test(before)) throw new WorkbenchInputError("Некорректный курсор журнала")
      const edits = withHomonymReviewDb((db) => listTokenEdits(db, slug, before))
      return json({ edits: edits.slice(0, 20), more: edits.length > 20 })
    }
    if (p.has("token")) {
      const id = p.get("token")
      if (!validTokenId(id)) throw new WorkbenchInputError("Некорректный токен")
      const detail = withHomonymReviewDb((db) => tokenDetail(db, slug, id))
      return detail ? json(detail) : json({ error: "Токен не найден. Возможно, документ переразмечен." }, 404)
    }
    const filter = p.get("filter") || "problems"
    const cursor = p.get("cursor") || undefined
    const direction = p.get("direction") || "after"
    const search = p.get("q") || ""
    if (!["problems", "all", "manual"].includes(filter) || !["after", "before", "from"].includes(direction) || (cursor && !validTokenId(cursor)) || search.length > 120) throw new WorkbenchInputError("Некорректные параметры очереди")
    return json(withHomonymReviewDb((db) => tokenQueue(db, slug, filter as "problems" | "all" | "manual", cursor, direction as "after" | "before" | "from", search)))
  } catch (error) { return errorResponse(error) }
}
export async function POST(request: NextRequest, context: Context) {
  const session = await auth()
  if (!session || !await checkPermission(session, Feature.CorpusTokenDisambiguate)) return json({ error: "Unauthorized" }, 403)
  const slug = decodeSlugParam((await context.params).slug)
  // Bound JSON, including requests using chunked transfer encoding.
  const text = await request.text()
  if (text.length > 16000) return json({ error: "Слишком большой запрос" }, 413)
  try {
    const body: unknown = JSON.parse(text)
    if (!body || typeof body !== "object") throw new WorkbenchInputError("Некорректный запрос")
    if ("action" in body && body.action === "undo") {
      if (!("editId" in body) || typeof body.editId !== "string" || !/^[a-f0-9-]{36}$/.test(body.editId)) throw new WorkbenchInputError("Нужен идентификатор правки")
      const editId = body.editId
      const result = withHomonymReviewDb((db) => undoTokenEdit(db, slug, editId, session.user?.id ?? session.user?.email ?? "unknown"))
      return result.conflict ? json({ error: "Откат заблокирован: после этой правки изменился токен, разбор или контекст." }, 409) : json(result)
    }
    if (!("tokenId" in body) || !validTokenId(body.tokenId) || !("revision" in body) || typeof body.revision !== "string" || !/^[a-f0-9]{64}$/.test(body.revision)) throw new WorkbenchInputError("Нужны токен и его текущая версия")
    const selection = parseSelection(body)
    let manualLexeme: { slug: string; lemma: string; pos: string } | undefined
    if ("wordSlug" in selection) {
      // Separate DB read before the corpus transaction. Never join the databases.
      const lexeme = await prismaData.lexeme.findUnique({ where: { slug: selection.wordSlug }, select: { slug: true, value: true, pos: true } })
      const pos = lexeme?.pos?.toUpperCase()
      if (!lexeme || !pos || !isValidPos(pos)) throw new WorkbenchInputError("Лексема отсутствует в словаре или её часть речи не поддерживается")
      manualLexeme = { slug: lexeme.slug, lemma: lexeme.value || lexeme.slug, pos }
    }
    const tokenId = body.tokenId
    const revision = body.revision
    return json(withHomonymReviewDb((db) => saveTokenEdit(db, { slug, tokenId, revision, selection, manualLexeme, user: { id: session.user?.id, email: session.user?.email } })))
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Некорректный JSON" }, 400)
    return errorResponse(error)
  }
}
