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
        // Токен разрешён вручную — он больше не в очереди массовой разметки
        // (см. lib/corpus/homonymGroup.ts).
        homonymGroupKey: null,
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

export type ResolveHomonymGroupResult =
  | { status: "not_found" }
  | { status: "invalid_input"; message: string }
  | { status: "ok"; resolvedTokens: number; wordSlug: string; lemma: string; pos: string }

/**
 * Массовое разрешение омонимов (roadmap п.111): одно решение модератора
 * закрывает ВСЕ токены группы — токены с той же нормализованной словоформой и
 * тем же набором конкурирующих лексем (ключ см. lib/corpus/homonymGroup.ts).
 *
 * Отличие от resolveTokenHomonym принципиальное: там выбирается конкретный
 * CorpusTokenCandidate (а с ним и граммема), здесь выбирается ЛЕКСЕМА, а
 * граммема у каждого токена своя — она берётся из его собственного лучшего
 * кандидата на эту лексему. Поэтому массовое решение честно закрывает только
 * конкуренцию РАЗНЫХ лексем; спор о граммеме одной лексемы сюда не попадает
 * (у таких токенов ключа группы нет).
 *
 * Реализовано тремя SQL-апдейтами в одной транзакции, а не циклом по токенам:
 * в верхних группах по 50–80 тыс. токенов, построчный Prisma-цикл на них
 * занял бы минуты. Параметров-идентификаторов нет вовсе — все подвыборки идут
 * по индексированному homonymGroupKey, а не по списку id (иначе на 80 тыс.
 * значений повторилась бы ошибка RangeError из reanalyzeDocument.ts).
 *
 * После разрешения токены получают resolutionSource='manual' (реанализ их не
 * трогает) и homonymGroupKey=NULL (выпадают из очереди).
 */
export async function resolveTokenHomonymGroup(
  groupKey: string,
  wordSlug: string,
): Promise<ResolveHomonymGroupResult> {
  if (!groupKey || !wordSlug) {
    return { status: "invalid_input", message: "groupKey and wordSlug are required" }
  }

  const autoTokens = await prismaCorpus.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "CorpusToken"
    WHERE "homonymGroupKey" = ${groupKey} AND "resolutionSource" = 'auto'
  `
  if (Number(autoTokens[0]?.n ?? 0) === 0) return { status: "not_found" }

  // Лексема обязана быть среди кандидатов группы — произвольный слаг из
  // запроса не принимается, иначе опечатка модератора разошлась бы по всем
  // токенам группы.
  const lexeme = await prismaCorpus.$queryRaw<{ lemma: string; pos: string }[]>`
    SELECT c."lemma" AS lemma, c."pos" AS pos
    FROM "CorpusTokenCandidate" c
    JOIN "CorpusToken" t ON t."id" = c."tokenId"
    WHERE t."homonymGroupKey" = ${groupKey} AND c."wordSlug" = ${wordSlug}
    LIMIT 1
  `
  if (lexeme.length === 0) {
    return { status: "invalid_input", message: "wordSlug is not a candidate of this group" }
  }
  const { lemma, pos } = lexeme[0]

  const [bumped, promoted, resolved] = await prismaCorpus.$transaction([
    // 1. Все кандидаты, кроме выбранной лексемы, сдвигаются на шаг вниз, чтобы
    //    освободить rank 0 и не оставить двух «текущих».
    prismaCorpus.$executeRaw`
      UPDATE "CorpusTokenCandidate" SET "rank" = "rank" + 1
      WHERE "wordSlug" <> ${wordSlug}
        AND "tokenId" IN (
          SELECT "id" FROM "CorpusToken"
          WHERE "homonymGroupKey" = ${groupKey} AND "resolutionSource" = 'auto'
        )
    `,
    // 2. Лучший кандидат выбранной лексемы у каждого токена становится rank 0
    //    и помечается ручным. Скалярная подвыборка даёт по одному id на токен;
    //    если у токена такого кандидата нет, NULL просто ни с чем не совпадёт.
    prismaCorpus.$executeRaw`
      UPDATE "CorpusTokenCandidate" SET "rank" = 0, "source" = 'manual'
      WHERE "id" IN (
        SELECT (
          SELECT c2."id" FROM "CorpusTokenCandidate" c2
          WHERE c2."tokenId" = t."id" AND c2."wordSlug" = ${wordSlug}
          ORDER BY c2."rank" ASC, c2."id" ASC LIMIT 1
        )
        FROM "CorpusToken" t
        WHERE t."homonymGroupKey" = ${groupKey} AND t."resolutionSource" = 'auto'
      )
    `,
    // 3. Сам токен: лексема фиксирована, граммема — из его лучшего кандидата
    //    (COALESCE — страховка на случай, если кандидата не оказалось).
    prismaCorpus.$executeRaw`
      UPDATE "CorpusToken" SET
        "wordSlug" = ${wordSlug},
        "lemma" = ${lemma},
        "pos" = ${pos},
        "matchCount" = 1,
        "resolutionSource" = 'manual',
        "homonymGroupKey" = NULL,
        "feats" = COALESCE((
          SELECT c3."feats" FROM "CorpusTokenCandidate" c3
          WHERE c3."tokenId" = "CorpusToken"."id" AND c3."wordSlug" = ${wordSlug}
          ORDER BY c3."rank" ASC, c3."id" ASC LIMIT 1
        ), "feats")
      WHERE "homonymGroupKey" = ${groupKey} AND "resolutionSource" = 'auto'
    `,
  ])

  void bumped
  void promoted
  return { status: "ok", resolvedTokens: resolved, wordSlug, lemma, pos }
}
