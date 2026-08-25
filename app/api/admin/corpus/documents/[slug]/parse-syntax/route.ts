import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { parseDocumentSyntax } from "@/lib/corpus/syntax/parseDocument"
import { decodeSlugParam } from "@/lib/slug"

/**
 * Синтаксический разбор уже проанализированного (POS/feats размечен)
 * документа — отдельный шаг от /reanalyze (тот перезапускает токенизатор
 * с нуля; этот только строит dependency-граф над уже существующими
 * токенами, значительно легче). Гейтится отдельной Feature.CorpusSyntaxEdit
 * (не CorpusBuilder) — конкретное действие, а не общий доступ к
 * конструктору корпуса, см. правило в AGENTS.md про checkPermission на
 * каждый мутирующий роут для конкретного действия.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusSyntaxEdit))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug: rawSlug } = await params
  const slug = decodeSlugParam(rawSlug)

  try {
    const result = await parseDocumentSyntax(slug)
    if (!result) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("Syntax parsing failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
