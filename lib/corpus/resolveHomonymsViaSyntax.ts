import { prismaCorpus } from "@/lib/prisma"
import { UD_DEPREL, getVerbGovernment } from "@/lib/corpus/syntax"
import { normalizeCaseValue } from "@/lib/corpus/tokenizer/caseNormalize"
import { MorphoGrammarFeats } from "@/lib/grammar/morphology"

// Та же величина, что GOVERNMENT_BONUS в dbAnalyzer.ts (управление предлога) —
// управление глагола так же почти грамматическое правило, не статистическая
// склонность. Складывается с уже накопленным score (частотность/предлог/
// флавор), а не заменяет его — конфликтующие сигналы гасят друг друга, что
// и является желаемым поведением при неопределённости.
const SYNTAX_GOVERNMENT_BONUS = 1_000_000

const GOVERNED_ROLES = [UD_DEPREL.OBJ, UD_DEPREL.IOBJ, UD_DEPREL.OBL] as string[]

// SQLite имеет предел числа bind-параметров в одном запросе (классически
// 999, в современных сборках может быть больше, но не гарантированно) —
// найдено эмпирически: документ вроде "maly-princ-lat" (полная книга) имеет
// тысячи неоднозначных токенов, и построение `IN (...)` по всем их id за
// один раз ("The query parameter limit... exceeded") реально валилось.
// Чанкуем каждый IN-запрос, а не полагаемся на то, что документ маленький.
const SQL_IN_CHUNK = 400

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export interface SyntaxResolveResult {
  ambiguousTotal: number
  dependencyEdgesConsidered: number
  winnersChanged: number
}

/**
 * "Проход C" плана разрешения омонимии: доразрешает токены, которые всё ещё
 * неоднозначны (matchCount>1, resolutionSource!=='manual') после токенизации
 * (Фаза 2) и флавор-приоритета (Фаза 3), используя уже построенный
 * dependency-граф (см. app/api/admin/corpus/documents/[slug]/parse-syntax) —
 * а не эвристику "слово слева" из DbAnalyzer. Требует, чтобы синтаксис уже
 * был разобран для документа; если CorpusDependency пуст или VerbGovernment
 * пуст (по умолчанию — см. lib/corpus/syntax/government.ts), результат
 * корректно "ничего не поменялось", а не ошибка.
 *
 * Возвращает null, если документа с таким slug нет.
 */
export async function resolveHomonymsViaSyntax(slug: string): Promise<SyntaxResolveResult | null> {
  const doc = await prismaCorpus.corpusDocument.findUnique({ where: { slug } })
  if (!doc) return null

  // Отдельно от кандидатов (см. ниже) — вложенный include кандидатов при
  // выборке сразу всех неоднозначных токенов документа сам генерирует
  // `WHERE tokenId IN (...)` по всем их id за один раз и на документах с
  // тысячами омонимов (напр. полная книга) упирается в лимит параметров SQLite.
  const ambiguousTokensBase = await prismaCorpus.corpusToken.findMany({
    where: { documentSlug: slug, matchCount: { gt: 1 }, resolutionSource: { not: "manual" } },
    select: { id: true, wordSlug: true, pos: true, feats: true },
  })
  if (ambiguousTokensBase.length === 0) {
    return { ambiguousTotal: 0, dependencyEdgesConsidered: 0, winnersChanged: 0 }
  }

  const ambiguousIds = ambiguousTokensBase.map((t) => t.id)

  // Рёбра, где неоднозначный токен — зависимый в роли "управляемое
  // глаголом дополнение" (см. VerbGovernmentRole в lib/corpus/syntax/government.ts).
  const deps: { depTokenId: bigint; headTokenId: bigint | null }[] = []
  for (const idsChunk of chunk(ambiguousIds, SQL_IN_CHUNK)) {
    const rows = await prismaCorpus.corpusDependency.findMany({
      where: { depTokenId: { in: idsChunk }, relation: { in: GOVERNED_ROLES }, headTokenId: { not: null } },
      select: { depTokenId: true, headTokenId: true },
    })
    deps.push(...rows)
  }
  if (deps.length === 0) {
    return { ambiguousTotal: ambiguousTokensBase.length, dependencyEdgesConsidered: 0, winnersChanged: 0 }
  }

  // Только токены, у которых реально нашлось governed-ребро, нуждаются в
  // кандидатах — обычно на порядки меньше, чем ambiguousIds целиком.
  const relevantIds = [...new Set(deps.map((d) => d.depTokenId))]
  const ambiguousTokens: Array<(typeof ambiguousTokensBase)[number] & {
    candidates: { id: number; wordSlug: string; lemma: string; pos: string; feats: unknown; score: number; source: string }[]
  }> = []
  const baseById = new Map(ambiguousTokensBase.map((t) => [t.id, t]))
  for (const idsChunk of chunk(relevantIds, SQL_IN_CHUNK)) {
    const cands = await prismaCorpus.corpusTokenCandidate.findMany({
      where: { tokenId: { in: idsChunk } },
      select: { id: true, tokenId: true, wordSlug: true, lemma: true, pos: true, feats: true, score: true, source: true },
      orderBy: { rank: "asc" },
    })
    const byToken = new Map<bigint, typeof cands>()
    for (const c of cands) {
      const arr = byToken.get(c.tokenId)
      if (arr) arr.push(c)
      else byToken.set(c.tokenId, [c])
    }
    for (const id of idsChunk) {
      const base = baseById.get(id)
      if (base) ambiguousTokens.push({ ...base, candidates: byToken.get(id) ?? [] })
    }
  }

  const headIds = [...new Set(deps.map((d) => d.headTokenId!))]
  const headTokens: { id: bigint; lemma: string }[] = []
  for (const idsChunk of chunk(headIds, SQL_IN_CHUNK)) {
    const rows = await prismaCorpus.corpusToken.findMany({
      where: { id: { in: idsChunk } },
      select: { id: true, lemma: true },
    })
    headTokens.push(...rows)
  }
  const headLemmaById = new Map(headTokens.map((t) => [t.id, t.lemma]))

  // Возвратность: у глагола-головы есть зависимый sę/se (relation='expl',
  // см. lib/corpus/syntax/clause.ts) — sę может менять управление
  // (см. getVerbGovernment(lemma, reflexive)).
  const reflexiveHeadIds = new Set<bigint>()
  for (const idsChunk of chunk(headIds, SQL_IN_CHUNK)) {
    const explDeps = await prismaCorpus.corpusDependency.findMany({
      where: { headTokenId: { in: idsChunk }, relation: UD_DEPREL.EXPL },
      select: { headTokenId: true },
    })
    for (const d of explDeps) if (d.headTokenId != null) reflexiveHeadIds.add(d.headTokenId)
  }

  const depByAmbiguousId = new Map(deps.map((d) => [d.depTokenId, d]))

  let winnersChanged = 0
  const candidateWrites: { id: number; score: number; source: string; rank: number }[] = []
  const tokenWrites: { id: bigint; wordSlug: string; lemma: string; pos: string; feats: Record<string, string> }[] = []

  for (const token of ambiguousTokens) {
    const edge = depByAmbiguousId.get(token.id)
    if (!edge || edge.headTokenId == null) continue

    const verbLemma = headLemmaById.get(edge.headTokenId)
    if (!verbLemma) continue

    const reflexive = reflexiveHeadIds.has(edge.headTokenId)
    const government = getVerbGovernment(verbLemma, reflexive)
    if (government.length === 0) continue

    const expectedCases = new Set(government.map((g) => g.requiredCase))

    let anyCaseCandidate = false
    const rescored = token.candidates.map((c) => {
      const caseValue = normalizeCaseValue((c.feats as MorphoGrammarFeats | null)?.case)
      if (!caseValue) return { ...c }
      anyCaseCandidate = true
      const bonus = expectedCases.has(caseValue) ? SYNTAX_GOVERNMENT_BONUS : -SYNTAX_GOVERNMENT_BONUS
      return { ...c, score: c.score + bonus, source: "context_gov" }
    })
    if (!anyCaseCandidate) continue

    rescored.sort((a, b) => b.score - a.score)
    rescored.forEach((c, rank) => {
      candidateWrites.push({ id: c.id, score: c.score, source: c.source, rank })
    })

    const winner = rescored[0]
    // wordSlug/pos одинаковы у всех кандидатов одной лексемы — различаться
    // может только feats (падеж/число/род), поэтому сравнение не может
    // ограничиться wordSlug/pos, иначе смена ранга внутри одной леммы
    // (самый частый случай — именно падеж) никогда не запишется.
    const winnerChanged =
      winner.wordSlug !== token.wordSlug ||
      winner.pos !== token.pos ||
      JSON.stringify(winner.feats) !== JSON.stringify(token.feats)
    if (winnerChanged) {
      winnersChanged++
      tokenWrites.push({
        id: token.id,
        wordSlug: winner.wordSlug,
        lemma: winner.lemma,
        pos: winner.pos,
        feats: winner.feats as Record<string, string>,
      })
    }
  }

  const BATCH_SIZE = 1000
  for (let i = 0; i < candidateWrites.length; i += BATCH_SIZE) {
    const batch = candidateWrites.slice(i, i + BATCH_SIZE)
    await prismaCorpus.$transaction(async (tx) => {
      for (const c of batch) {
        await tx.corpusTokenCandidate.update({ where: { id: c.id }, data: { score: c.score, source: c.source, rank: c.rank } })
      }
    })
  }
  for (let i = 0; i < tokenWrites.length; i += BATCH_SIZE) {
    const batch = tokenWrites.slice(i, i + BATCH_SIZE)
    await prismaCorpus.$transaction(async (tx) => {
      for (const t of batch) {
        await tx.corpusToken.update({
          where: { id: t.id },
          data: { wordSlug: t.wordSlug, lemma: t.lemma, pos: t.pos, feats: t.feats },
        })
      }
    })
  }

  return { ambiguousTotal: ambiguousTokensBase.length, dependencyEdgesConsidered: deps.length, winnersChanged }
}
