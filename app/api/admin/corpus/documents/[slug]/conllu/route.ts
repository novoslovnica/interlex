import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { documentToConllU, SyntaxToken, ConlluSentenceInput } from "@/lib/corpus/syntax"
import { MorphoGrammarFeats } from "@/lib/grammar/common"

/**
 * Экспорт документа в CoNLL-U (см. lib/corpus/syntax/conllu.ts). Только
 * чтение уже сохранённого dependency-графа (CorpusDependency) — не
 * запускает разбор заново, поэтому та же Feature.CorpusSyntaxEdit, что и
 * у /syntax-редактора (просмотр разбора — часть той же возможности).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusSyntaxEdit))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug } = await params

  const doc = await prismaCorpus.corpusDocument.findUnique({ where: { slug }, select: { slug: true } })
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const sentences = await prismaCorpus.corpusSentence.findMany({
    where: { documentSlug: slug },
    orderBy: { position: "asc" },
    select: {
      id: true,
      rawText: true,
      tokens: {
        orderBy: { tokenIndex: "asc" },
        select: { id: true, tokenIndex: true, surfaceForm: true, lemma: true, pos: true, feats: true },
      },
      dependencies: {
        select: { depTokenId: true, headTokenId: true, relation: true, confidence: true, source: true },
      },
    },
  })

  const input: ConlluSentenceInput[] = sentences.map(s => ({
    sentId: s.id,
    rawText: s.rawText,
    tokens: s.tokens.map((t): SyntaxToken => ({
      id: t.id,
      tokenIndex: t.tokenIndex,
      surfaceForm: t.surfaceForm,
      lemma: t.lemma,
      pos: t.pos,
      feats: (t.feats as MorphoGrammarFeats | null) ?? {},
    })),
    edges: s.dependencies.map(e => ({
      depTokenId: e.depTokenId,
      headTokenId: e.headTokenId,
      relation: e.relation,
      confidence: e.confidence as "rule" | "heuristic" | "unresolved",
    })),
  }))

  const conllu = documentToConllU(input)

  return new NextResponse(conllu, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.conllu"`,
    },
  })
}
