import { prismaCorpus } from "@/lib/prisma"
import { resolveLexemeDisplayValues } from "@/lib/lexemeDisplayValue"
import {
  diceCoefficient,
  logLikelihood,
  classifyByLogLikelihood,
  type ContingencyCounts,
} from "./metrics"

// Roadmap #44 "Браузер устойчивых словосочетаний/n-грамм" (план
// groovy-soaring-wall). N-generic by design: extending to a new size is
// adding it to NGRAM_SIZES, not a schema/query change per size (see
// CorpusNgram's schema comment in prisma/corpus.schema.prisma for why).
export const NGRAM_SIZES = [2, 3, 4, 5] as const

// Verified against production corpus.db (636k tokens): 74,838 distinct
// bigram types unfiltered, only 9,760 survive freq>=3; trigrams already
// down to 2,115 at the same floor. Sparsity only increases with n, so this
// single floor keeps every size's row count small without needing a
// per-size cutoff.
export const MIN_NGRAM_FREQUENCY = 3

const NGRAM_KEY_SEP = "␟"

export interface MatchedTokenRow {
  sentenceId: string
  wordIndex: number
  wordSlug: string
  lemma: string
  pos: string
}

export interface WordUnit {
  wordIndex: number
  span: number // сколько CorpusToken-строк схлопнуто в этот юнит (см. ниже)
  slug: string
  lemma: string
  pos: string
}

// Схлопывает подряд идущие токены ОДНОГО предложения (уже отсортированные
// по wordIndex) с одинаковым wordSlug в один WordUnit — след многословной
// лексемы (Lexeme.isCollocation), см. CollocationMatcher/tokenizer.ts:
// каждый токен внутри совпавшего спана получает один и тот же
// wordSlug/lemma/pos. Вынесено отдельной функцией, чтобы findNgramExamples.ts
// мог переиспользовать ровно ту же логику, что computeNgrams использовал
// при подсчёте, а не дублировать её.
export function collapseIntoUnits(sentenceTokens: MatchedTokenRow[]): WordUnit[] {
  const units: WordUnit[] = []
  for (const t of sentenceTokens) {
    const last = units[units.length - 1]
    if (last && last.slug === t.wordSlug && last.wordIndex + last.span === t.wordIndex) {
      last.span += 1
    } else {
      units.push({ wordIndex: t.wordIndex, span: 1, slug: t.wordSlug, lemma: t.lemma, pos: t.pos })
    }
  }
  return units
}

// Разбивает юниты одного предложения на непрерывные забеги: разрыв в
// wordIndex между юнитами означает, что между ними стоит непризнанное
// ("красное") слово — фраза через него не считается смежной.
export function splitIntoContiguousRuns(units: WordUnit[]): WordUnit[][] {
  const runs: WordUnit[][] = []
  let runStart = 0
  for (let i = 1; i <= units.length; i++) {
    const brokenHere = i === units.length || units[i].wordIndex !== units[i - 1].wordIndex + units[i - 1].span
    if (brokenHere) {
      runs.push(units.slice(runStart, i))
      runStart = i
    }
  }
  return runs
}

interface NgramAccum {
  n: number
  slugs: string[]
  lemmas: string[]
  pos: string[]
  count: number
}

export interface ComputeNgramsResult {
  totalMatchedTokens: number
  written: Record<number, number>
}

function accumulateRun(run: WordUnit[], acc: Map<string, NgramAccum>) {
  for (const n of NGRAM_SIZES) {
    if (run.length < n) continue
    for (let start = 0; start + n <= run.length; start++) {
      const window = run.slice(start, start + n)
      const slugs = window.map((u) => u.slug)
      const key = `${n}${NGRAM_KEY_SEP}${slugs.join(NGRAM_KEY_SEP)}`
      const existing = acc.get(key)
      if (existing) {
        existing.count += 1
      } else {
        acc.set(key, {
          n,
          slugs,
          lemmas: window.map((u) => u.lemma),
          pos: window.map((u) => u.pos),
          count: 1,
        })
      }
    }
  }
}

// Один линейный проход по токенам корпуса со скользящим окном — не N-1
// self-join'ов на каждый размер (что не масштабируется на произвольный n,
// см. обсуждение в плане). Тот же приём, каким n-граммы извлекают
// стандартные NLP-инструменты (nltk.ngrams и т.п.).
export async function computeNgrams(): Promise<ComputeNgramsResult> {
  const tokens = (await prismaCorpus.corpusToken.findMany({
    where: { wordSlug: { not: null } },
    select: { sentenceId: true, wordIndex: true, wordSlug: true, lemma: true, pos: true },
    orderBy: [{ sentenceId: "asc" }, { wordIndex: "asc" }],
  })) as MatchedTokenRow[]

  const totalMatchedTokens = tokens.length
  const unigramFreq = new Map<string, number>()
  for (const t of tokens) {
    unigramFreq.set(t.wordSlug, (unigramFreq.get(t.wordSlug) ?? 0) + 1)
  }

  const accum = new Map<string, NgramAccum>()
  let currentSentenceId: string | null = null
  let sentenceTokens: MatchedTokenRow[] = []

  const flushSentence = () => {
    if (sentenceTokens.length >= 2) {
      const units = collapseIntoUnits(sentenceTokens)
      for (const run of splitIntoContiguousRuns(units)) {
        accumulateRun(run, accum)
      }
    }
    sentenceTokens = []
  }

  for (const t of tokens) {
    if (t.sentenceId !== currentSentenceId) {
      flushSentence()
      currentSentenceId = t.sentenceId
    }
    sentenceTokens.push(t)
  }
  flushSentence()

  const candidates = [...accum.values()].filter((e) => e.count >= MIN_NGRAM_FREQUENCY)

  // CorpusToken.lemma is, in practice, always identical to wordSlug (e.g.
  // "iz-ADP", "avtor-NOUN") — not a display-ready word form. Lexeme.value
  // itself isn't either: it's a search/matching-normalization field, not
  // the real orthographic form (see lib/lexemeDisplayValue.ts) — the actual
  // written form is the CORE flavor's "standard" allophone. Resolved here
  // batched (same pattern compute-collocations.ts already uses for its
  // candidate list: a separate interlex.db query merged in JS, not a
  // cross-db join) so the browser shows real spelling, not raw slugs.
  const distinctSlugs = [...new Set(candidates.flatMap((e) => e.slugs))]
  const valueBySlug = await resolveLexemeDisplayValues(distinctSlugs)
  const displayValue = (slug: string) => valueBySlug.get(slug)?.value ?? slug

  const rows: {
    n: number
    ngramKey: string
    slugs: string[]
    lemmas: string[]
    posPattern: string
    displayText: string
    frequency: number
    score: number
    logLikelihood: number | null
    dice: number | null
  }[] = []

  for (const entry of candidates) {
    const componentFreqs = entry.slugs.map((s) => unigramFreq.get(s) ?? entry.count)
    const productFreqs = componentFreqs.reduce((p, f) => p * f, 1)

    // Обобщённый PMI: log2(f_ngram * N^(k-1) / Π f_i). Для k=2 это ровно
    // обычный PMI (см. lib/corpus/collocations/metrics.ts::pmi) — единая
    // метрика ранжирования для любого n, а не отдельная формула на размер.
    // Не привязана к конкретной опубликованной метрике для k>2 — это
    // приближение для ранжирования/фильтрации, не заявляется как
    // авторитетная величина (в отличие от logLikelihood ниже).
    const score =
      productFreqs > 0 && totalMatchedTokens > 0
        ? Math.log2((entry.count * Math.pow(totalMatchedTokens, entry.n - 1)) / productFreqs)
        : 0

    let logLikelihoodValue: number | null = null
    let diceValue: number | null = null
    if (entry.n === 2) {
      const counts: ContingencyCounts = {
        f1: componentFreqs[0],
        f2: componentFreqs[1],
        f12: entry.count,
        n: totalMatchedTokens,
      }
      const ll = logLikelihood(counts)
      // Тот же порог значимости, что уже использует admin-инструмент
      // "семантическое поле" (LL_PERIPHERY_THRESHOLD) — ниже него пара
      // не считается настоящей коллокацией, а шумом.
      if (classifyByLogLikelihood(ll) === null) continue
      logLikelihoodValue = ll
      diceValue = diceCoefficient(counts)
    }

    const displayWords = entry.slugs.map(displayValue)
    rows.push({
      n: entry.n,
      ngramKey: entry.slugs.join(NGRAM_KEY_SEP),
      slugs: entry.slugs,
      lemmas: displayWords,
      posPattern: entry.pos.join("_"),
      displayText: displayWords.join(" "),
      frequency: entry.count,
      score,
      logLikelihood: logLikelihoodValue,
      dice: diceValue,
    })
  }

  // Полный перезалив при каждом прогоне — здесь нет ручных модераторских
  // правок, которые нужно защищать (в отличие от CorpusDependency.source/
  // semantic_relations.source), так что delete+reinsert проще и безопаснее
  // инкрементального upsert.
  await prismaCorpus.corpusNgram.deleteMany({})

  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prismaCorpus.corpusNgram.createMany({ data: rows.slice(i, i + CHUNK) })
  }

  const written: Record<number, number> = {}
  for (const size of NGRAM_SIZES) {
    written[size] = rows.filter((r) => r.n === size).length
  }

  return { totalMatchedTokens, written }
}
