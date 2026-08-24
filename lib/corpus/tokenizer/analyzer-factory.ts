import { prismaData } from "@/lib/prisma"
import { DbAnalyzer, WordBaseRecord, AnomalyMatch, InflectionAnomalyIndex, FoldedBaseIndex } from "./dbAnalyzer"
import { generateWordForms } from "@/lib/grammar/morphology/engine"
import { CollocationRecord } from "./collocationMatcher"
import { normalizeSurfaceForm } from "@/lib/corpus/candidates/reconstruct"
import { isValidPos } from "@/lib/grammar/common"
import { foldDiacritics } from "./foldDiacritics"
import { expandVariants, lexemeVariants } from "./lexemeVariants"

// Лексема без единого Meaning не несёт информации: её нечего показать на
// странице слова и бессмысленно вешать на корпусный токен. На текущих
// данных это ровно один блок битого импорта — 3 097 строк, id 22411-25507,
// все без стема, без значений и без переводов ("ęoati", "gygnivų", "him",
// "mt", "sux"...), тогда как среди лексем со стемом таких НЕТ НИ ОДНОЙ.
// Они успели попасть в base_homonyms (4 311 записей) и нагенерировать
// 15 485 аллофонов, а 673 из них уже выигрывали корпусные токены — то есть
// раздували омонимию и подменяли собой настоящие слова.
//
// Фильтр, а не удаление: строки остаются в словаре (вдруг это заготовка на
// доработку), просто не участвуют в распознавании. Снимается одной правкой,
// если блок когда-нибудь наполнят значениями.
const HAS_MEANING = { meanings: { some: {} } } as const

// InflectionAnomaly (`inflection_anomalies`, data.db) хранит суппletивные/
// нерегулярные формы конкретных лексем (напр. "jest"/"sųt" у "byti" — не
// раскладываются на стем+окончание вообще, это не "неправильное окончание",
// а другой корень). До этой функции таблица была write-only: заполнялась
// через /admin/words редактирование, но ни один код распознавания/генерации
// форм её не читал — DbAnalyzer никогда не находил такие токены (см. AGENTS.md
// "Corpus Candidate Proposals", находка при разборе почему "jest"/"sut"
// красные). Ключ — та же нормализация (lowercase + этимологический
// кир.→лат.), что и у самого surface form в DbAnalyzer.analyzeWord, чтобы
// совпадать с уже приведённым к этому виду токеном.
export async function buildInflectionAnomalyIndex(): Promise<InflectionAnomalyIndex> {
  const rows = await prismaData.inflectionAnomaly.findMany({
    where: { lexeme: HAS_MEANING },
    select: {
      inflection: true,
      grammeme: true,
      lexeme: { select: { slug: true, value: true, pos: true, corpusFrequencyPerMln: true } },
    },
  })
  const map: InflectionAnomalyIndex = new Map()
  // 16 из 237 строк inflection_anomalies на момент написания — точные
  // дубликаты (тот же lexemeId+inflection+grammeme дважды, напр. у "byti") —
  // без дедупликации это удвоило бы matchCount у затронутых слов на пустом
  // месте. Ключ дедупликации — то же (wordSlug, grammeme), а не сырая
  // строка целиком, чтобы устоять и к будущим дублям с чуть другим
  // написанием inflection, но той же граммемой.
  const seenPerKey = new Set<string>()
  for (const r of rows) {
    const pos = r.lexeme.pos?.toUpperCase()
    if (!pos || !isValidPos(pos)) continue
    const key = normalizeSurfaceForm(r.inflection)
    if (!key) continue
    const dedupeKey = `${key}|${r.lexeme.slug}|${r.grammeme}`
    if (seenPerKey.has(dedupeKey)) continue
    seenPerKey.add(dedupeKey)
    const entry: AnomalyMatch = {
      wordSlug: r.lexeme.slug,
      lemma: r.lexeme.value ?? r.lexeme.slug,
      pos,
      grammeme: r.grammeme,
      corpusFrequencyPerMln: r.lexeme.corpusFrequencyPerMln,
    }
    const arr = map.get(key)
    if (arr) arr.push(entry)
    else map.set(key, [entry])
  }
  return map
}

export async function buildValidEndings(): Promise<Set<string>> {
  const rows = await prismaData.endingAllophone.findMany({
    select: { value: true },
  })
  const endings = new Set<string>(rows.map((r) => r.value))
  // Свёрнутые варианты тех же окончаний: в корпусе больше трети словных
  // токенов написаны без диакритики ("jezyku" вместо "języku"), и у таких
  // словоформ окончание тоже свёрнутое. Без этого DbAnalyzer даже не
  // порождает гипотетическую основу — слово не доходит до сопоставления
  // парадигмы. Множество используется только для «какой суффикс можно
  // отрезать», не для генерации форм, поэтому расширение здесь ничего не
  // фабрикует (см. lib/corpus/tokenizer/foldDiacritics.ts).
  for (const value of [...endings]) endings.add(foldDiacritics(value))
  endings.add("")
  return endings
}

// Однословные предлоги (pos=ADP) — для распознавания "механического хвоста"
// многословных глаголов ("глагол + sę/se"/"предлог") в lib/grammar/verb/mechanicalTail.ts.
export async function buildKnownPrepositions(): Promise<string[]> {
  const rows = await prismaData.lexeme.findMany({
    where: { pos: "ADP", ...HAS_MEANING },
    select: { value: true },
  })
  return rows
    .map((r) => r.value)
    .filter((v): v is string => !!v && !v.includes(" "))
}

// Многословные лексемы (Lexeme.isCollocation=true) — для точного
// сопоставления фраз в токенизаторе (lib/corpus/tokenizer/collocationMatcher.ts).
export async function buildCollocationRecords(): Promise<CollocationRecord[]> {
  const rows = await prismaData.lexeme.findMany({
    where: { isCollocation: true, ...HAS_MEANING },
    select: { slug: true, value: true, pos: true },
  })
  return rows
    .filter((r): r is { slug: string; value: string; pos: string } => !!r.value && !!r.pos)
    .map((r) => ({ wordSlug: r.slug, lemma: r.value, pos: r.pos }))
}

// Свёрнутый индекс основ: свёрнутое (без диакритики) написание -> id лексем.
//
// Закрывает две дыры стадии поиска лексемы, обе измерены на живом корпусе
// (scripts/db/measure-corpus-recognition.ts):
//  1. base_homonyms индексирует ТОЛЬКО стем ("pisa" у "pisati"), поэтому
//     цитатная форма глагола недостижима: инфинитивного окончания -ti в
//     ending_allophones нет вообще, отрезать нечего. 66 815 вхождений в
//     корпусе — это ровно словарные формы существующих VERB-лексем.
//  2. Индекс хранит каноническое написание ("język", "veľmi"), а корпус
//     сплошь и рядом написан упрощённо ("jezyk", "velmi").
//
// Индекс строится в памяти (как buildInflectionAnomalyIndex), а не новой
// таблицей: он полностью производный от lexemes/lexeme_allophones и должен
// перестраиваться вместе с ними, а base_homonyms остаётся тем, чем был —
// каноническим индексом, который правит модератор (см. syncBaseHomonym в
// app/api/lexicon/[id]/updateField/service.ts).
export async function buildFoldedBaseIndex(): Promise<FoldedBaseIndex> {
  const index: FoldedBaseIndex = new Map()
  const add = (raw: string | null | undefined, id: number) => {
    if (!raw) return
    const key = foldDiacritics(raw.toLowerCase().trim())
    if (!key) return
    const ids = index.get(key)
    if (ids) {
      if (!ids.includes(id)) ids.push(id)
    } else {
      index.set(key, [id])
    }
  }

  const lexemes = await prismaData.lexeme.findMany({
    where: HAS_MEANING,
    select: { id: true, value: true, stem: true },
  })
  for (const l of lexemes) {
    for (const variant of expandVariants(l.value)) add(variant, l.id)
    for (const variant of expandVariants(l.stem)) add(variant, l.id)
  }

  // Готовые флейворные написания (EAST/WEST/SOUTH/NSL) той же лексемы.
  // Меряется отдельно: поверх свёртки они добавляют всего ~10 тыс.
  // вхождений из 1,33 млн красных — свёртка почти всё перекрывает сама
  // (западный флейвор отличается от неё только ų/ǫ -> o вместо -> u).
  // Оставлены, потому что стоят один запрос и ловят как раз этот остаток.
  const allophones = await prismaData.lexemeAllophone.findMany({
    where: { lexeme: HAS_MEANING },
    select: { lexemeId: true, value: true },
  })
  for (const a of allophones) add(a.value, a.lexemeId)

  // base_homonyms в свёрнутом виде — те же основы, что и сейчас, но
  // достижимые при упрощённом написании словоформы.
  const homonyms = await prismaData.baseHomonym.findMany({
    select: { base: true, wordIds: true },
  })
  for (const h of homonyms) {
    for (const id of parseWordIds(h.wordIds).keys()) add(h.base, id)
  }

  return index
}

// base_homonyms.wordIds живёт в двух форматах: исходный плоский number[] и
// более новый {id, flavor}[] (см. AGENTS.md, Flavor System). Разбор был
// заинлайнен в createQueryWordsByBase — вынесен, чтобы им же пользовался
// buildFoldedBaseIndex.
function parseWordIds(raw: string): Map<number, string> {
  const result = new Map<number, string>()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return result
  }
  if (!Array.isArray(parsed)) return result
  for (const item of parsed) {
    if (typeof item === "number") result.set(item, "CORE")
    else if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "number") {
      const entry = item as { id: number; flavor?: string }
      result.set(entry.id, entry.flavor || "CORE")
    }
  }
  return result
}

// Индекс всех словоформ, которые грамматический движок умеет породить:
// свёрнутая словоформа -> id лексем.
//
// Зачем, если формы и так генерируются в DbAnalyzer.matchForms: чтобы форма
// дошла до сопоставления, DbAnalyzer сперва должен УГАДАТЬ границу основы,
// отрезав окончание из ending_allophones. Граница в таблице морфологическая,
// а в словоформе — поверхностная, и они расходятся: движок порождает
// "imajųt" (3pl от "imati", стем "ima"), но окончания "jųt" в таблице нет,
// поэтому основа "imaj" не проверяется, а "ima" не проверяется с окончанием
// "jųt" — форма генерируется и остаётся недостижимой. На живом корпусе это
// 103 341 вхождение сверх того, что ловится свёрнутыми основами
// (scripts/db/measure-corpus-recognition.ts).
//
// Строится в памяти, а не таблицей, сознательно: индекс производен сразу от
// двух вещей — словаря И грамматического движка. Таблица устаревала бы при
// каждой правке lib/grammar/ (а их в этом проекте много, см. AGENTS.md), и
// расхождение было бы молчаливым. Цена — 7,7 с и ~53 МБ на процесс,
// измерено на 24 440 лексемах / 883 355 формах; собирается лениво, один раз
// (см. createDbAnalyzer и getAnalyzer в вызывающих роутах).
export async function buildGeneratedFormIndex(): Promise<FoldedBaseIndex> {
  const lexemes = await prismaData.lexeme.findMany({
    where: HAS_MEANING,
    select: {
      id: true, slug: true, value: true, pos: true, protoStemClass: true,
      stemExtension: true, paradigm: true, stem: true, gender: true,
      animacy: true, isCollocation: true,
    },
  })

  const index: FoldedBaseIndex = new Map()
  for (const l of lexemes) {
    if (!l.value || !l.pos || !isValidPos(l.pos.toUpperCase())) continue
    // Каждый вариант склоняется отдельно: подать движку стем
    // "altana, altank" целиком — значит получить мусорную парадигму.
    const variantPairs = lexemeVariants(l.value, l.stem)
    const forms = []
    for (const variant of variantPairs) {
      try {
        forms.push(...generateWordForms({
          id: l.id,
          slug: l.slug,
          isv: variant.value,
          pos: l.pos.toUpperCase(),
          protoStemClass: l.protoStemClass,
          stemExtension: l.stemExtension,
          paradigm: l.paradigm,
          stem: variant.stem,
          gender: l.gender,
          animacy: l.animacy,
          alternationType: null,
          fleetingVowelAt: null,
          flavor: "CORE",
          isCollocation: l.isCollocation ?? false,
        }, true))
      } catch {
        // Одна лексема с кривыми грамматическими полями не должна ронять
        // построение индекса целиком — на текущих данных таких нет (0 ошибок
        // на 24 440 лексемах), но данные правит модератор.
        continue
      }
    }
    for (const form of forms) {
      const key = foldDiacritics(form.surfaceForm.toLowerCase())
      // Односимвольные ключи не индексируем — по той же причине, что и в
      // createQueryWordsByBase: они дают ложные совпадения на артефактах
      // токенизации, а реальные однобуквенные слова находятся точным
      // поиском по base_homonyms.
      if (key.length < 2) continue
      const ids = index.get(key)
      if (ids) {
        if (!ids.includes(l.id)) ids.push(l.id)
      } else {
        index.set(key, [l.id])
      }
    }
  }
  return index
}

// Единая точка сборки анализатора. До неё все 11 мест конструирования
// повторяли одну и ту же связку из четырёх билдеров вручную — из-за чего
// добавление нового индекса требовало не забыть 11 файлов (ровно так
// InflectionAnomaly и оставался годами write-only, см. AGENTS.md).
export async function createDbAnalyzer(): Promise<DbAnalyzer> {
  const [validEndings, knownPrepositions, inflectionAnomalies, foldedBases, generatedForms] = await Promise.all([
    buildValidEndings(),
    buildKnownPrepositions(),
    buildInflectionAnomalyIndex(),
    buildFoldedBaseIndex(),
    buildGeneratedFormIndex(),
  ])
  return new DbAnalyzer(
    createQueryWordsByBase(foldedBases, generatedForms),
    validEndings,
    knownPrepositions,
    inflectionAnomalies
  )
}

export function createQueryWordsByBase(
  foldedBases?: FoldedBaseIndex,
  generatedForms?: FoldedBaseIndex,
): (
  bases: string[],
) => Promise<WordBaseRecord[]> {
  return async (bases: string[]): Promise<WordBaseRecord[]> => {
    const homonyms = await prismaData.baseHomonym.findMany({
      where: { base: { in: bases } },
    })

    const lexemeFlavors = new Map<number, string>()
    for (const h of homonyms) {
      for (const [id, flavor] of parseWordIds(h.wordIds)) {
        lexemeFlavors.set(id, flavor)
      }
    }

    // Свёрнутый индекс — дополнение к точному поиску, а не замена: точное
    // совпадение по канонической основе остаётся первичным и сохраняет
    // свой флейвор, свёрнутые попадания добавляются как CORE.
    if (foldedBases) {
      for (const base of bases) {
        // Односимвольные основы через свёртку не ищем. В словаре есть
        // мусорные однобуквенные лексемы с пустым стемом ("je", "ě", "t"
        // как NOUN) и лексема "ljev" со стемом "l" — после свёртки любой
        // одиночный диакритический символ в корпусе ("ę", "ť", "ľ" —
        // артефакты токенизации) начинал совпадать сразу с несколькими из
        // них. Точный поиск по base_homonyms этим не затронут: реальные
        // однобуквенные слова ("v", "k", "s", "i", "a") лежат там без
        // диакритики и находятся как раньше.
        if (base.length < 2) continue
        const ids = foldedBases.get(foldDiacritics(base.toLowerCase()))
        if (!ids) continue
        for (const id of ids) {
          if (!lexemeFlavors.has(id)) lexemeFlavors.set(id, "CORE")
        }
      }
    }

    // Индекс готовых словоформ. DbAnalyzer передаёт сюда в том числе саму
    // словоформу целиком (вариант с нулевым окончанием), поэтому отдельный
    // параметр не нужен. Лишние кандидаты, пойманные на коротких гипотезах
    // основы, отсеются в matchForms — она всё равно сверяет каждую лексему
    // с реальной словоформой.
    if (generatedForms) {
      for (const base of bases) {
        if (base.length < 2) continue
        const ids = generatedForms.get(foldDiacritics(base.toLowerCase()))
        if (!ids) continue
        for (const id of ids) {
          if (!lexemeFlavors.has(id)) lexemeFlavors.set(id, "CORE")
        }
      }
    }

    const ids = [...lexemeFlavors.keys()]
    if (ids.length === 0) return []

    const rows = await prismaData.lexeme.findMany({
      where: { id: { in: ids }, ...HAS_MEANING },
      select: {
        id: true,
        slug: true,
        value: true,
        pos: true,
        protoStemClass: true,
        stemExtension: true,
        paradigm: true,
        stem: true,
        gender: true,
        animacy: true,
        isCollocation: true,
        corpusFrequencyPerMln: true,
      },
    })
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      isv: r.value,
      pos: r.pos,
      protoStemClass: r.protoStemClass,
      stemExtension: r.stemExtension,
      paradigm: r.paradigm,
      stem: r.stem,
      gender: r.gender,
      animacy: r.animacy,
      base: null,
      alternationType: null,
      fleetingVowelAt: null,
      flavor: lexemeFlavors.get(r.id) ?? "CORE",
      isCollocation: r.isCollocation,
      corpusFrequencyPerMln: r.corpusFrequencyPerMln,
    }))
  }
}