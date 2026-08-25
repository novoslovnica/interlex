import { prismaCorpus } from "@/lib/prisma"
import { parseComplexSentence, saveDependencies, SyntaxToken } from "@/lib/corpus/syntax"
import { MorphoGrammarFeats } from "@/lib/grammar/common"

export interface ParseSyntaxResult {
  sentencesProcessed: number
  edgesWritten: number
  tokensTotal: number
}

/**
 * Строит dependency-граф над уже размеченными токенами одного документа.
 *
 * Отдельный шаг от реанализа: тот перезапускает токенизатор с нуля, а этот
 * только читает существующие lemma/pos/feats и пишет рёбра — значительно
 * дешевле и не трогает разметку.
 *
 * Вынесено из роута app/api/admin/corpus/documents/[slug]/parse-syntax,
 * чтобы массовый прогон и кнопка в админке шли одним кодом: в этом проекте
 * параллельные реализации одной операции расходились уже не раз.
 *
 * Возвращает null, если документа нет. Ручные рёбра (source='manual') не
 * затрагиваются — saveDependencies удаляет и пересоздаёт только 'auto'.
 */
export async function parseDocumentSyntax(slug: string): Promise<ParseSyntaxResult | null> {
  const doc = await prismaCorpus.corpusDocument.findUnique({ where: { slug }, select: { slug: true } })
  if (!doc) return null

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
    const syntaxTokens: SyntaxToken[] = sentenceTokens.map((t) => ({
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

  return { sentencesProcessed, edgesWritten, tokensTotal: tokens.length }
}
