import { prismaData } from "@/lib/prisma"
import { PosType, GrammaticalGender } from "@/lib/grammar/common"
import { getEnding } from "@/lib/grammar/endingLoader"
import { buildGrammeme } from "@/lib/grammar/grammemes"
import { etymCyrToEtymLat } from "@/lib/transliteration"
import { identifyStemTypeByDb, resolveGender, EnhancedDbItem } from "@/lib/grammar/stemClassifier"

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

// Классы настоящего времени, из которых инфинитив выводится однозначно.
// Это обратная сторона extractProtoStems (lib/grammar/verb/index.ts): там
// инфинитив разбирается на основы, здесь основа собирается обратно в
// инфинитив. Восстановимо не всё — см. infinitiveFromPresentStem.
const VERB_PRESENT_STEM_TYPES = new Set([
  "verb_present_athematic_a", "verb_present_athematic_i", "verb_present_thematic_e",
])

const ADVERB_COMPARATIVE_STEM_TYPE = "adverb_comp"

// Продуктивные финали наречий в ISV (образование от прилагательных:
// dobry -> dobro, iskrenny -> iskrenne).
const ADVERB_SURFACE_ENDINGS = ["o", "e"]

/**
 * Восстанавливает инфинитив по основе настоящего времени.
 *
 * Возвращает null там, где вывод недостоверен — лучше не показать гипотезу,
 * чем показать выдуманную:
 *  - класс I (тематическое -e после согласной, "mogų/mogut"): основа
 *    палатализована, обратное преобразование неоднозначно (moć-/mog-), а
 *    инфинитив может быть и на -ti, и на -ći;
 *  - формы 1 л. ед. и 3 л. мн. классов на -i, где -i отброшено и произошла
 *    йотация ("govorjų" от "govoriti") — та же неоднозначность.
 */
function infinitiveFromPresentStem(stemType: string, stem: string): string | null {
  // Краткая парадигма на -am: основа перед окончанием — уже основа
  // инфинитива ("ima" + "m"), поэтому просто +ti.
  if (stemType === "verb_present_athematic_a") {
    return stem.endsWith("a") ? stem + "ti" : null
  }

  // Класс IV: основа настоящего = корень + i ("govori" + š).
  if (stemType === "verb_present_athematic_i") {
    return stem.endsWith("i") ? stem + "ti" : null
  }

  // Тематическое -e: класс определяется тем, что стоит перед ним.
  if (stemType === "verb_present_thematic_e") {
    if (stem.endsWith("aje")) return stem.slice(0, -2) + "ti"        // znaje -> znati
    if (stem.endsWith("uje")) return stem.slice(0, -3) + "ovati"     // kupuje -> kupovati
    if (stem.endsWith("ne")) return stem.slice(0, -2) + "nųti"       // krikne -> kriknųti
    return null                                                       // класс I — не выводим
  }

  return null
}

/**
 * Доля словаря, приходящаяся на каждый класс основ. Нужна, чтобы не
 * предлагать классы, которых в языке фактически нет.
 *
 * Замерено на живом словаре (13 398 существительных): o 52%, ā 17%, jo 13%,
 * i 9%, jā 9% — и при этом u-основы 19 лексем (0,14%), консонантные 14
 * (0,10%). Генератор же предлагал u_basis и все четыре consonant_* для
 * КАЖДОГО из 186 761 кластера: 933 805 строк, 47% таблицы, ради классов, в
 * которых суммарно 33 слова. Причём consonant_er (термины родства mati/dъkti)
 * и consonant_ent (детёныши telę) — семантически закрытые классы, новые
 * слова в них не появляются.
 *
 * Считается из данных, а не хардкодом: классы определяются тем же
 * identifyStemTypeByDb, что и при реальном склонении, поэтому список
 * подстроится сам, если словарь изменится.
 */
export type StemTypeSupport = Map<string, number>

export async function buildStemTypeSupport(): Promise<StemTypeSupport> {
  const lexemes = await prismaData.lexeme.findMany({
    where: { pos: { in: ["NOUN", "ADJ"] }, meanings: { some: {} } },
    select: { pos: true, value: true, gender: true, protoStemClass: true, stemExtension: true },
  })

  const counts = new Map<string, number>()
  let nounTotal = 0
  let adjTotal = 0

  for (const l of lexemes) {
    if (l.pos === "ADJ") {
      adjTotal++
      // Прилагательные различаются мягкостью основы, а не protoStemClass;
      // отдельного признака в словаре нет, поэтому оба класса считаются
      // поддержанными — их и так всего два, вырожденного перебора нет.
      counts.set("adj_hard", (counts.get("adj_hard") ?? 0) + 1)
      counts.set("adj_soft", (counts.get("adj_soft") ?? 0) + 1)
      continue
    }
    nounTotal++
    const stemType = identifyStemTypeByDb({
      interslavic: l.value ?? "",
      protoSlavic: l.value ?? "",
      paradigm: "A",
      gender: resolveGender(l.gender, l.protoStemClass ?? undefined),
      protoStemClass: l.protoStemClass ?? "o",
      stemExtension: l.stemExtension ?? undefined,
    } as EnhancedDbItem)
    counts.set(stemType, (counts.get(stemType) ?? 0) + 1)
  }

  const support: StemTypeSupport = new Map()
  for (const [stemType, n] of counts) {
    const total = stemType.startsWith("adj_") ? adjTotal : nounTotal
    support.set(stemType, total > 0 ? n / total : 0)
  }
  return support
}

// Ниже этой доли словаря класс не предлагается вовсе. 1% выбран так, чтобы
// отсечь u-основы (0,14%) и консонантные (0,10%), не задев ни один живой
// класс: следующий снизу — jā/i с 9%, то есть запас почти на порядок.
export const MIN_STEM_TYPE_SUPPORT = 0.01

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
  support?: StemTypeSupport,
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

    // Совпало ПУСТОЕ окончание — значит про морфологию слова не известно
    // ничего: основой стало всё слово целиком. В таком случае единственная
    // защитимая гипотеза — «слово уже стоит в словарной форме»; дописывать
    // к нему цитатное окончание другого класса значит выдумывать буквы на
    // пустом месте ("by" -> "byo"/"bya"/"byi"). На живых данных таких
    // выдуманных строк было 1 003 090 — ровно половина всей таблицы.
    const evidenceless = endLen === 0

    // Наречие — открытый класс и при этом неизменяемое: его словарная форма
    // совпадает с формой в тексте, никакого окончания отрезать не нужно.
    // Раньше наречия не предлагались вообще (adverb_* были исключены как
    // "закрытые классы" — это верно про степени сравнения, но не про сам
    // класс). Предлагаем не на каждое слово подряд, а на продуктивные
    // финали -o/-e, которыми наречия в ISV и образуются от прилагательных.
    if (evidenceless && ADVERB_SURFACE_ENDINGS.some((e) => clean.endsWith(e))) {
      addHypothesis(seen, PosType.ADV, "adverb", "Degree=Pos", clean, clean, rank)
    }

    for (const m of matches) {
      // Класс, которого в словаре фактически нет, не предлагаем вообще —
      // см. buildStemTypeSupport.
      //
      // Проверка применяется ТОЛЬКО к именным и адъективным классам: именно
      // для них buildStemTypeSupport считает доли по словарю. У глагольных и
      // наречных stemType опоры нет и быть не может, поэтому безусловное
      // сравнение с порогом вырезало их все до единого — включая работавшую
      // до этого ветку l-причастия.
      const measured = NOUN_STEM_TYPES.has(m.stemType) || ADJ_STEM_TYPES.has(m.stemType)
      if (measured && support && (support.get(m.stemType) ?? 0) < MIN_STEM_TYPE_SUPPORT) continue
      if (NOUN_STEM_TYPES.has(m.stemType)) {
        for (const gender of citationGendersForNoun(m.stemType)) {
          const citationEnding = getEnding(m.stemType, "singular", "nom", "CORE", gender)
          if (evidenceless && citationEnding) continue
          const guessedGrammeme = buildGrammeme("nom", "singular", gender)
          addHypothesis(seen, PosType.NOUN, m.stemType, guessedGrammeme, stem, stem + citationEnding, rank)
        }
      } else if (ADJ_STEM_TYPES.has(m.stemType)) {
        const citationEnding = getEnding(m.stemType, "singular", "nom", "CORE", GrammaticalGender.MASC)
        if (evidenceless && citationEnding) continue
        const guessedGrammeme = buildGrammeme("nom", "singular", GrammaticalGender.MASC)
        addHypothesis(seen, PosType.ADJ, m.stemType, guessedGrammeme, stem, stem + citationEnding, rank)
      } else if (VERB_PRESENT_STEM_TYPES.has(m.stemType)) {
        // Глаголов в очереди много, а раньше из всей глагольной парадигмы
        // распознавалось только l-причастие — поэтому "imajut", "dumam",
        // "koristate" не давали ни одной глагольной гипотезы вовсе.
        const infinitive = infinitiveFromPresentStem(m.stemType, stem)
        if (infinitive) {
          addHypothesis(seen, PosType.VERB, m.stemType, "VerbForm=Inf", stem, infinitive, rank)
        }
      } else if (m.stemType === ADVERB_COMPARATIVE_STEM_TYPE) {
        // Сравнительная степень наречия ("brzěje") -> положительная ("brzo").
        addHypothesis(seen, PosType.ADV, m.stemType, "Degree=Pos", stem, stem + "o", rank)
      } else if (m.stemType === VERB_LPART_STEM_TYPE) {
        // Стандартная славянская эвристика: l-причастие minus l/la/lo/li/le
        // = основа инфинитива, plus -ti. Приблизительно (без учёта
        // чередований на стыке), поэтому это черновик для модератора, а не
        // готовая форма — как и всё остальное в этой таблице.
        if (evidenceless) continue
        addHypothesis(seen, PosType.VERB, m.stemType, "VerbForm=Inf", stem, stem + "ti", rank)
      }
      // Остальные stemType (verb_present_*/verb_aorist_*/verb_imperfect/
      // verb_imperative/verb_part_*/numeral_*/collective_*/adverb_*) —
      // сознательно пропускаются, см. комментарий у VERB_LPART_STEM_TYPE выше.
    }
  }

  // Схлопываем гипотезы, ведущие к ОДНОЙ И ТОЙ ЖЕ словарной статье: для
  // модератора "завести ли слово X как существительное в им. ед." — одно
  // решение, а не четыре одинаковых строки, отличающихся только тем, какому
  // историческому классу основ приписан результат. Класс — деталь, которая
  // всё равно уточняется при заведении лексемы; представителем оставляем
  // наиболее поддержанный словарём (при равенстве — с лучшим rank).
  const collapsed = new Map<string, CandidateHypothesis>()
  for (const h of seen.values()) {
    const key = `${h.guessedPos}|${h.guessedGrammeme}|${h.reconstructedForm}`
    const existing = collapsed.get(key)
    if (!existing) {
      collapsed.set(key, h)
      continue
    }
    const better =
      h.rank < existing.rank ||
      (h.rank === existing.rank &&
        (support?.get(h.guessedStemType) ?? 0) > (support?.get(existing.guessedStemType) ?? 0))
    if (better) collapsed.set(key, h)
  }

  return Array.from(collapsed.values()).sort((a, b) => a.rank - b.rank)
}
