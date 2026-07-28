import { prismaCorpus, prismaData } from "@/lib/prisma"
import { isValidPos } from "@/lib/grammar/common"

export interface ResolveTokenInput {
  candidateId?: number
  wordSlug?: string
  feats?: Record<string, string>
}

export type ResolveTokenResult =
  | { status: "not_found" }
  | { status: "invalid_input"; message: string }
  | { status: "ok"; wordSlug: string; lemma: string; pos: string; feats: Record<string, string> }

/**
 * Ручное разрешение омонима (план разрешения омонимии, Фаза 5) — вынесено
 * из app/api/.../resolve/route.ts тем же приёмом, что и
 * lib/corpus/reanalyzeDocument.ts в Фазе 1: роут делает только auth +
 * вызов, а бизнес-логика тестируется напрямую (без необходимости подделывать
 * NextAuth-сессию в скрипте проверки).
 *
 * Либо выбор одного из уже сгенерированных CorpusTokenCandidate
 * (candidateId), либо свободное указание лексема+граммема (wordSlug/feats),
 * не обязанное присутствовать среди кандидатов — см. открытый вопрос плана
 * "задание связи на лексему+граммему". wordSlug в свободном режиме
 * валидируется против prismaData.lexeme (interlex.db) — двухфазный запрос
 * (сперва чтение из interlex.db, затем запись в corpus.db), тот же паттерн,
 * что уже применяется в analyzer-factory.ts.
 *
 * После разрешения matchCount=1, resolutionSource='manual' — реанализ
 * (reanalyzeCorpusDocument) и синтаксический "проход C"
 * (resolveHomonymsViaSyntax) больше не трогают этот токен.
 */
export async function resolveTokenHomonym(
  slug: string,
  tokenId: bigint,
  input: ResolveTokenInput,
): Promise<ResolveTokenResult> {
  const token = await prismaCorpus.corpusToken.findFirst({
    where: { id: tokenId, documentSlug: slug },
    select: { id: true },
  })
  if (!token) return { status: "not_found" }

  const existingCandidates = await prismaCorpus.corpusTokenCandidate.findMany({
    where: { tokenId },
    orderBy: { rank: "asc" },
  })

  let winner: { wordSlug: string; lemma: string; pos: string; feats: Record<string, string> }
  let chosenCandidateId: number | null = null
  let newCandidateData: typeof winner | null = null

  if (typeof input.candidateId === "number") {
    const candidate = existingCandidates.find((c) => c.id === input.candidateId)
    if (!candidate) return { status: "invalid_input", message: "Candidate not found for this token" }
    winner = {
      wordSlug: candidate.wordSlug,
      lemma: candidate.lemma,
      pos: candidate.pos,
      feats: (candidate.feats ?? {}) as Record<string, string>,
    }
    chosenCandidateId = candidate.id
  } else if (typeof input.wordSlug === "string" && input.wordSlug.length > 0) {
    const lexeme = await prismaData.lexeme.findUnique({
      where: { slug: input.wordSlug },
      select: { slug: true, pos: true },
    })
    if (!lexeme || !lexeme.pos) return { status: "invalid_input", message: "Unknown wordSlug — no such lexeme in the dictionary" }
    const posTag = lexeme.pos.toUpperCase()
    if (!isValidPos(posTag)) return { status: "invalid_input", message: `Lexeme has unrecognized pos: ${lexeme.pos}` }

    const feats = input.feats && typeof input.feats === "object" ? input.feats : {}
    winner = { wordSlug: lexeme.slug, lemma: lexeme.slug, pos: posTag, feats }

    const matching = existingCandidates.find(
      (c) => c.wordSlug === winner.wordSlug && JSON.stringify(c.feats ?? {}) === JSON.stringify(feats),
    )
    if (matching) {
      chosenCandidateId = matching.id
    } else {
      newCandidateData = winner
    }
  } else {
    return { status: "invalid_input", message: "candidateId or wordSlug is required" }
  }

  await prismaCorpus.$transaction(async (tx) => {
    await tx.corpusToken.update({
      where: { id: tokenId },
      data: {
        wordSlug: winner.wordSlug,
        lemma: winner.lemma,
        pos: winner.pos,
        feats: winner.feats,
        matchCount: 1,
        resolutionSource: "manual",
      },
    })

    // Остальные кандидаты не удаляются (история/аудит того, что
    // рассматривалось) — только перераспределяется rank, выбранный всегда
    // становится 0-м.
    let nextRank = 1
    for (const c of existingCandidates) {
      if (c.id === chosenCandidateId) continue
      await tx.corpusTokenCandidate.update({ where: { id: c.id }, data: { rank: nextRank } })
      nextRank++
    }

    if (chosenCandidateId !== null) {
      await tx.corpusTokenCandidate.update({
        where: { id: chosenCandidateId },
        data: { rank: 0, source: "manual" },
      })
    } else if (newCandidateData) {
      await tx.corpusTokenCandidate.create({
        data: {
          tokenId,
          wordSlug: newCandidateData.wordSlug,
          lemma: newCandidateData.lemma,
          pos: newCandidateData.pos,
          feats: newCandidateData.feats,
          rank: 0,
          source: "manual",
          score: 0,
        },
      })
    }
  })

  return { status: "ok", ...winner }
}
