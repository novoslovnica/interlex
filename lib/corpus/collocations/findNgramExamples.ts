import { prismaCorpus } from "@/lib/prisma"
import { collapseIntoUnits, splitIntoContiguousRuns, type MatchedTokenRow } from "./computeNgrams"

const MAX_CANDIDATE_SENTENCES = 50

export interface NgramExample {
  sentenceId: string
  rawText: string
}

// Находит до `limit` предложений, где заданная последовательность slugs
// действительно встречается смежно (с той же логикой схлопывания
// многословных лексем и разбиения на непрерывные забеги, что и
// computeNgrams.ts — не дублирует её заново, переиспользует). Не зависит
// от сломанной публичной страницы /corpus (см. план) — самодостаточно.
export async function findNgramExamples(slugs: string[], limit = 5): Promise<NgramExample[]> {
  if (slugs.length < 2) return []

  // Кандидаты — предложения, где первые два слова n-граммы стоят РЯДОМ
  // (прямой self-join, а не "первые N предложений со словом 1 в
  // произвольном порядке слева" — для частого первого слова вроде
  // предлога такая выборка почти всегда пропускает реальные совпадения,
  // т.к. без ORDER BY Prisma возвращает произвольный срез). Дальнейшая
  // проверка полной длины n-граммы (для n>2) — через тот же
  // collapse+contiguous-run код, что и в computeNgrams.ts.
  const adjacentPairs = await prismaCorpus.$queryRaw<{ sentenceId: string }[]>`
    SELECT DISTINCT a."sentenceId" AS "sentenceId"
    FROM "CorpusToken" a
    JOIN "CorpusToken" b
      ON a."sentenceId" = b."sentenceId"
     AND b."wordIndex" = a."wordIndex" + 1
    WHERE a."wordSlug" = ${slugs[0]}
      AND b."wordSlug" = ${slugs[1]}
    LIMIT ${MAX_CANDIDATE_SENTENCES}
  `

  const examples: NgramExample[] = []
  for (const { sentenceId } of adjacentPairs) {
    if (examples.length >= limit) break

    const sentenceTokens = (await prismaCorpus.corpusToken.findMany({
      where: { sentenceId, wordSlug: { not: null } },
      select: { sentenceId: true, wordIndex: true, wordSlug: true, lemma: true, pos: true },
      orderBy: { wordIndex: "asc" },
    })) as MatchedTokenRow[]

    const units = collapseIntoUnits(sentenceTokens)
    const runs = splitIntoContiguousRuns(units)

    const matches = runs.some((run) => {
      if (run.length < slugs.length) return false
      for (let start = 0; start + slugs.length <= run.length; start++) {
        const window = run.slice(start, start + slugs.length)
        if (window.every((u, i) => u.slug === slugs[i])) return true
      }
      return false
    })

    if (matches) examples.push({ sentenceId, rawText: "" })
  }

  if (examples.length === 0) return []

  const sentences = await prismaCorpus.corpusSentence.findMany({
    where: { id: { in: examples.map((e) => e.sentenceId) } },
    select: { id: true, rawText: true },
  })
  const textById = new Map(sentences.map((s) => [s.id, s.rawText]))

  return examples.map((e) => ({ sentenceId: e.sentenceId, rawText: textById.get(e.sentenceId) ?? "" }))
}
