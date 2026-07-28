import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { resolveHomonymsViaSyntax } from "@/lib/corpus/resolveHomonymsViaSyntax"

/**
 * "Проход C" плана разрешения омонимии — отдельное действие от /reanalyze
 * (Фаза 2/3, эвристика "слово слева") и от /parse-syntax (строит сам
 * dependency-граф). Запускается после того, как синтаксис уже разобран —
 * доразрешает оставшиеся омонимы через реальное управление глагола-головы
 * вместо соседнего слова. Гейтится Feature.CorpusTokenDisambiguate (заведена
 * в Фазе 1 для этой группы действий, не CorpusBuilder/CorpusSyntaxEdit).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug } = await params

  try {
    const result = await resolveHomonymsViaSyntax(slug)
    if (!result) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("Syntax-based homonym resolution failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
