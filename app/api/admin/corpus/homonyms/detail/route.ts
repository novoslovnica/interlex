import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { fetchHomonymGroupDetail } from "@/lib/corpus/fetchHomonymGroups"

/**
 * Детали группы массовой разметки омонимов: конкурирующие лексемы и пример
 * предложения. Гейтится той же Feature.CorpusTokenDisambiguate, что и
 * разрешение — вне этого действия админки список кандидатов смысла не имеет.
 *
 * POST, а не GET: ключ группы содержит «␟» и «|» (см. lib/corpus/homonymGroup.ts),
 * и передавать его телом надёжнее, чем кодировать в query.
 *
 * Детали запрашиваются лениво по раскрытию группы, а не для всех строк списка:
 * в верхних группах по 50–80 тыс. токенов, и агрегировать кандидатов сразу по
 * двадцати таким группам на каждый рендер страницы — заметная задержка.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { groupKey?: string } | null
  if (!body || typeof body.groupKey !== "string" || body.groupKey.length === 0) {
    return NextResponse.json({ error: "groupKey is required" }, { status: 400 })
  }

  const detail = await fetchHomonymGroupDetail(body.groupKey)
  return NextResponse.json(detail)
}
