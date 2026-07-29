import { prismaData } from "@/lib/prisma"
import { DbAnalyzer, WordBaseRecord, AnomalyMatch, InflectionAnomalyIndex } from "./dbAnalyzer"
import { CollocationRecord } from "./collocationMatcher"
import { normalizeSurfaceForm } from "@/lib/corpus/candidates/reconstruct"
import { isValidPos } from "@/lib/grammar/common"

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
  endings.add("")
  return endings
}

// Однословные предлоги (pos=ADP) — для распознавания "механического хвоста"
// многословных глаголов ("глагол + sę/se"/"предлог") в lib/grammar/verb/mechanicalTail.ts.
export async function buildKnownPrepositions(): Promise<string[]> {
  const rows = await prismaData.lexeme.findMany({
    where: { pos: "ADP" },
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
    where: { isCollocation: true },
    select: { slug: true, value: true, pos: true },
  })
  return rows
    .filter((r): r is { slug: string; value: string; pos: string } => !!r.value && !!r.pos)
    .map((r) => ({ wordSlug: r.slug, lemma: r.value, pos: r.pos }))
}

export function createQueryWordsByBase(): (
  bases: string[],
) => Promise<WordBaseRecord[]> {
  return async (bases: string[]): Promise<WordBaseRecord[]> => {
    const homonyms = await prismaData.baseHomonym.findMany({
      where: { base: { in: bases } },
    })

    const lexemeFlavors = new Map<number, string>()
    for (const h of homonyms) {
      const parsed = JSON.parse(h.wordIds)
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === "number") {
          for (const id of parsed as number[]) {
            lexemeFlavors.set(id, "CORE")
          }
        } else {
          for (const item of parsed as Array<{ id: number; flavor?: string }>) {
            lexemeFlavors.set(item.id, item.flavor || "CORE")
          }
        }
      }
    }

    const ids = [...lexemeFlavors.keys()]
    if (ids.length === 0) return []

    const rows = await prismaData.lexeme.findMany({
      where: { id: { in: ids } },
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