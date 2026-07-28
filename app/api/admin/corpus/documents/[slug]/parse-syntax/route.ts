import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { parseComplexSentence, saveDependencies, SyntaxToken } from "@/lib/corpus/syntax"
import { MorphoGrammarFeats } from "@/lib/grammar/common"

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

  const { slug } = await params

  const doc = await prismaCorpus.corpusDocument.findUnique({ where: { slug } })
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  try {
    const tokens = await prismaCorpus.corpusToken.findMany({
      where: { documentSlug: slug },
      select: { id: true, tokenIndex: true, sentenceId: true, surfaceForm: true, lemma: true, pos: true, feats: true },
      orderBy: { tokenIndex: "asc" },
    })

    const bySentence = new Map<string, typeof tokens>()
    for (const t of tokens) {
      const arr = bySentence.get(t.sentenceId)
      if (arr) arr.push(t)
      else bySentence.set(t.sentenceId, [t])
    }

    let sentencesProcessed = 0
    let edgesWritten = 0

    for (const [sentenceId, sentenceTokens] of bySentence) {
      const syntaxTokens: SyntaxToken[] = sentenceTokens.map(t => ({
        id: t.id,
        tokenIndex: t.tokenIndex,
        surfaceForm: t.surfaceForm,
        lemma: t.lemma,
        pos: t.pos,
        feats: (t.feats as MorphoGrammarFeats | null) ?? {},
      }))

      const edges = parseComplexSentence(syntaxTokens)
      await saveDependencies(sentenceId, edges)
      sentencesProcessed++
      edgesWritten += edges.length
    }

    return NextResponse.json({
      ok: true,
      sentencesProcessed,
      edgesWritten,
      tokensTotal: tokens.length,
    })
  } catch (error) {
    console.error("Syntax parsing failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
