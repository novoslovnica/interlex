import { prismaData } from "@/lib/prisma"
import { PosType, GrammaticalGender } from "@/lib/grammar/common"
import { getEnding } from "@/lib/grammar/endingLoader"
import { buildGrammeme } from "@/lib/grammar/grammemes"
import { etymCyrToEtymLat } from "@/lib/transliteration"

// Тот же перебор длин окончания, что и DbAnalyzer.generateHypotheticalBases —
// нарочно не импортируется оттуда (там это приватные константы класса),
// но должен оставаться синхронизирован по смыслу: то же MAX_END_LEN/MIN_STEM_LEN.
const MAX_END_LEN = 4
const MIN_STEM_LEN = 2

export type ReconstructionRuleSource = "red_reverse_lookup" | "yellow_stem_sibling"

interface EndingReverseEntry {
  stemType: string
  grammeme: string
}

export type EndingReverseIndex = Map<string, EndingReverseEntry[]>

export interface CandidateHypothesis {
  guessedPos: PosType
  guessedStemType: string
  // Граммема ЦИТАТНОЙ формы, которую мы реконструируем (напр. именительный
  // ед.ч.) — НЕ граммема исходно совпавшего окончания. Одно и то же
  // совпадение (по stemType) всегда даёт одну и ту же цитатную форму,
  // независимо от того, каким падежом/числом токен совпал изначально.
  guessedGrammeme: string
  guessedStem: string
  reconstructedForm: string
  // 0 — самое специфичное совпадение (по длине совпавшего окончания) в
  // рамках одного вызова buildHypothesesForSurfaceForm.
  rank: number
}

const NOUN_STEM_TYPES = new Set([
  "o_hard", "o_soft", "a_hard", "a_soft", "u_basis", "i_basis",
  "consonant_n", "consonant_s", "consonant_ent", "consonant_er",
])
const ADJ_STEM_TYPES = new Set(["adj_hard", "adj_soft"])
// Только l-причастие. Остальные verb_present_*/verb_aorist_*/verb_imperfect/
// verb_imperative/verb_part_* сознательно исключены — восстановить
// инфинитив из основы наст. времени/аориста без знания тематического
// гласного и типа основы ненадёжно (тот же принцип "не фабриковать
// лингвистический факт", что и у пустого VerbGovernment, см. AGENTS.md).
// l-причастие — единственная verb-основа, из которой инфинитив
// восстанавливается простым правилом (-l/-la/-lo → +ti).
// numeral_*/collective_*/adverb_comp/adverb_sup тоже исключены: закрытые
// классы, предлагать по ним новую лексему бессмысленно.
const VERB_LPART_STEM_TYPE = "verb_lpart"

export function normalizeSurfaceForm(rawSurfaceForm: string): string {
  let clean = rawSurfaceForm.toLowerCase().trim()
  if (/[а-яѢѣѦѧѪѫ]/i.test(clean)) {
    clean = etymCyrToEtymLat(clean)
  }
  return clean
}

export async function buildEndingReverseIndex(): Promise<EndingReverseIndex> {
  const rows = await prismaData.endingAllophone.findMany({
    select: { stemType: true, grammeme: true, value: true },
  })
  const map: EndingReverseIndex = new Map()
  for (const r of rows) {
    const arr = map.get(r.value)
    if (arr) arr.push({ stemType: r.stemType, grammeme: r.grammeme })
    else map.set(r.value, [{ stemType: r.stemType, grammeme: r.grammeme }])
  }
  return map
}

function citationGendersForNoun(stemType: string): (string | undefined)[] {
  // a_hard/a_soft покрывают и средний род (базовое значение реестра), и
  // женский (FEMININE_OVERRIDES в scripts/db/seed-endings.ts) — оба
  // варианта реальны и неразличимы по одному совпавшему окончанию, поэтому
  // предлагаем обе гипотезы, а не гадаем.
  if (stemType === "a_hard" || stemType === "a_soft") {
    return [undefined, GrammaticalGender.FEM]
  }
  return [undefined]
}

function addHypothesis(
  seen: Map<string, CandidateHypothesis>,
  guessedPos: PosType,
  guessedStemType: string,
  guessedGrammeme: string,
  guessedStem: string,
  reconstructedForm: string,
  rank: number,
): void {
  const key = `${guessedStemType}|${guessedGrammeme}|${guessedStem}`
  const existing = seen.get(key)
  if (!existing || existing.rank > rank) {
    seen.set(key, { guessedPos, guessedStemType, guessedGrammeme, guessedStem, reconstructedForm, rank })
  }
}

/**
 * Перебирает длины окончания 0..MAX_END_LEN, ищет точное совпадение с любым
 * значением из ending_allophones (через reverseIndex) независимо от того,
 * какой лексеме оно исторически принадлежит, и для каждого совпавшего
 * (stemType, ...) реконструирует цитатную (словарную) форму того же класса
 * основ — не гадая произвольную морфологию, а переиспользуя уже
 * проверенные модератором значения ending_allophones (см. getEnding()).
 */
export function buildHypothesesForSurfaceForm(
  rawSurfaceForm: string,
  reverseIndex: EndingReverseIndex,
): CandidateHypothesis[] {
  const clean = normalizeSurfaceForm(rawSurfaceForm)
  if (!clean) return []

  const seen = new Map<string, CandidateHypothesis>()

  for (let endLen = 0; endLen <= MAX_END_LEN; endLen++) {
    const stemLen = clean.length - endLen
    if (stemLen < 1) continue
    if (stemLen < MIN_STEM_LEN && endLen > 0) continue

    const ending = clean.slice(stemLen)
    const stem = clean.slice(0, stemLen)
    const matches = reverseIndex.get(ending)
    if (!matches || matches.length === 0) continue

    const rank = MAX_END_LEN - endLen

    for (const m of matches) {
      if (NOUN_STEM_TYPES.has(m.stemType)) {
        for (const gender of citationGendersForNoun(m.stemType)) {
          const citationEnding = getEnding(m.stemType, "singular", "nominative", "CORE", gender)
          const guessedGrammeme = buildGrammeme("nominative", "singular", gender)
          addHypothesis(seen, PosType.NOUN, m.stemType, guessedGrammeme, stem, stem + citationEnding, rank)
        }
      } else if (ADJ_STEM_TYPES.has(m.stemType)) {
        const citationEnding = getEnding(m.stemType, "singular", "nominative", "CORE", GrammaticalGender.MASC)
        const guessedGrammeme = buildGrammeme("nominative", "singular", GrammaticalGender.MASC)
        addHypothesis(seen, PosType.ADJ, m.stemType, guessedGrammeme, stem, stem + citationEnding, rank)
      } else if (m.stemType === VERB_LPART_STEM_TYPE) {
        // Стандартная славянская эвристика: l-причастие minus l/la/lo/li/le
        // = основа инфинитива, plus -ti. Приблизительно (без учёта
        // чередований на стыке), поэтому это черновик для модератора, а не
        // готовая форма — как и всё остальное в этой таблице.
        addHypothesis(seen, PosType.VERB, m.stemType, "VerbForm=Inf", stem, stem + "ti", rank)
      }
      // Остальные stemType (verb_present_*/verb_aorist_*/verb_imperfect/
      // verb_imperative/verb_part_*/numeral_*/collective_*/adverb_*) —
      // сознательно пропускаются, см. комментарий у VERB_LPART_STEM_TYPE выше.
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.rank - b.rank)
}
