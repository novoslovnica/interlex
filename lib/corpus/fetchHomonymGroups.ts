import type { ReviewContext } from "@/lib/corpus/homonymReview"
import { prismaCorpus, prismaData } from "@/lib/prisma"
import { Prisma } from "@/prisma/generated/corpus/client"
import { parseHomonymGroupKey } from "@/lib/corpus/homonymGroup"
import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"

/**
 * Очередь массовой разметки омонимов (roadmap п.111). Читающая сторона
 * страницы /admin/corpus/homonyms.
 *
 * Группировка — целиком по индексированному CorpusToken.homonymGroupKey, а не
 * по вычислению набора кандидатов на лету: токенов 5,1 млн, и подсчёт «сколько
 * РАЗНЫХ лексем конкурирует» стоит ~2,5 минуты на живой базе
 * (`scripts/db/measure-corpus-ambiguity.ts`). Ключ поддерживается при записи
 * токенов (см. lib/corpus/homonymGroup.ts), поэтому очередь читается по
 * индексу.
 *
 * Фильтр по форме — через `(${prefix} IS NULL OR ... LIKE ${prefix})`, а не
 * через склейку фрагментов Prisma: `$queryRaw` возвращает промис, а не
 * `Prisma.Sql`-фрагмент, вкладывать его в другой шаблон нельзя.
 */

export interface HomonymGroupListRow {
  groupKey: string
  /** Нормализованная словоформа (первая часть ключа). */
  form: string
  /** Сколько неразрешённых вхождений ожидает контекстной проверки. */
  tokenCount: number
  documentCount: number
  /** Конкурирующие лексемы из самого ключа — краткая подпись в списке. */
  wordSlugs: string[]
}

export interface HomonymGroupCandidate {
  wordSlug: string
  lemma: string
  pos: string
  /** Сколько токенов группы вообще имеют эту лексему среди кандидатов. */
  candidateTokens: number
  /** Сколько токенов группы СЕЙЧАС решаются в пользу этой лексемы (авто-победитель). */
  currentWins: number
  /** Из интерфейсного словаря — для подсказки модератору, может быть null. */
  value: string | null
  corpusFrequencyPerMln: number | null
}

export interface HomonymGroupDetail {
  candidates: HomonymGroupCandidate[]
  contexts: ReviewContext[]
  nextCursor: string | null
}

// Форма-префикс для поиска по очереди; null означает «без фильтра».
function searchPrefix(search?: string): string | null {
  return search ? `${normalizeSurfaceForm(search)}%` : null
}

export async function countHomonymGroups(search?: string): Promise<number> {
  const prefix = searchPrefix(search)
  const rows = await prismaCorpus.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT "homonymGroupKey") AS n FROM "CorpusToken"
    WHERE "homonymGroupKey" IS NOT NULL
      AND (${prefix} IS NULL OR "homonymGroupKey" LIKE ${prefix})
  `
  return Number(rows[0]?.n ?? 0)
}

export async function fetchHomonymGroups(options: {
  search?: string
  offset: number
  limit: number
}): Promise<HomonymGroupListRow[]> {
  const { search, offset, limit } = options
  const prefix = searchPrefix(search)

  // Список — чисто по индексу homonymGroupKey: COUNT(*) без обращений к
  // таблице. COUNT(DISTINCT documentSlug) сюда НЕ входит намеренно — он требует
  // чтения строк и на 1,09 млн токенов заметно тормозит каждый рендер; число
  // документов добирается отдельным запросом только для показанных групп.
  const rows = await prismaCorpus.$queryRaw<
    { groupKey: string; tokenCount: bigint }[]
  >`
    SELECT "homonymGroupKey" AS groupKey, COUNT(*) AS tokenCount
    FROM "CorpusToken"
    WHERE "homonymGroupKey" IS NOT NULL
      AND (${prefix} IS NULL OR "homonymGroupKey" LIKE ${prefix})
    GROUP BY "homonymGroupKey"
    ORDER BY tokenCount DESC, groupKey ASC
    LIMIT ${limit} OFFSET ${offset}
  `

  const keys = rows.map((r) => r.groupKey)
  const documentCounts = new Map<string, number>()
  if (keys.length > 0) {
    const docRows = await prismaCorpus.$queryRaw<{ groupKey: string; documentCount: bigint }[]>`
      SELECT "homonymGroupKey" AS groupKey, COUNT(DISTINCT "documentSlug") AS documentCount
      FROM "CorpusToken"
      WHERE "homonymGroupKey" IN (${Prisma.join(keys)})
      GROUP BY "homonymGroupKey"
    `
    for (const r of docRows) documentCounts.set(r.groupKey, Number(r.documentCount))
  }

  return rows.map((r) => ({
    groupKey: r.groupKey,
    form: parseHomonymGroupKey(r.groupKey)?.form ?? r.groupKey,
    tokenCount: Number(r.tokenCount),
    documentCount: documentCounts.get(r.groupKey) ?? 0,
    wordSlugs: parseHomonymGroupKey(r.groupKey)?.wordSlugs ?? [],
  }))
}

/**
 * Конкурирующие лексемы группы (контексты читаются отдельно). Лексемы берутся из
 * кандидатов (в них есть lemma/pos), а словарная форма и частотность —
 * отдельным запросом в interlex.db: границу баз в одном запросе не пересекаем
 * (см. AGENTS.md).
 */
export async function fetchHomonymGroupDetail(groupKey: string): Promise<{ candidates: HomonymGroupCandidate[] }> {
  const candidateRows = await prismaCorpus.$queryRaw<
    { wordSlug: string; lemma: string; pos: string; candidateTokens: bigint; currentWins: bigint }[]
  >`
    SELECT c."wordSlug" AS wordSlug,
           MIN(c."lemma") AS lemma,
           MIN(c."pos") AS pos,
           COUNT(DISTINCT c."tokenId") AS candidateTokens,
           COUNT(DISTINCT CASE WHEN t."wordSlug" = c."wordSlug" THEN t."id" END) AS currentWins
    FROM "CorpusTokenCandidate" c
    JOIN "CorpusToken" t ON t."id" = c."tokenId"
    WHERE t."homonymGroupKey" = ${groupKey}
    GROUP BY c."wordSlug"
  `

  const slugs = candidateRows.map((c) => c.wordSlug)
  const lexemes = slugs.length > 0
    ? await prismaData.lexeme.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, value: true, corpusFrequencyPerMln: true },
      })
    : []
  const byLexemeSlug = new Map(lexemes.map((l) => [l.slug, l]))

  const candidates: HomonymGroupCandidate[] = candidateRows
    .map((c) => ({
      wordSlug: c.wordSlug,
      lemma: c.lemma,
      pos: c.pos,
      candidateTokens: Number(c.candidateTokens),
      currentWins: Number(c.currentWins),
      value: byLexemeSlug.get(c.wordSlug)?.value ?? null,
      corpusFrequencyPerMln: byLexemeSlug.get(c.wordSlug)?.corpusFrequencyPerMln ?? null,
    }))
    // Сверху — то, что уже выигрывает сейчас: самый вероятный разбор.
    .sort((a, b) => b.currentWins - a.currentWins || b.candidateTokens - a.candidateTokens)

  return { candidates }
}
