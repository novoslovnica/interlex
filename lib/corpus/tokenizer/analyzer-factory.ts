import { prismaData } from "@/lib/prisma"
import { DbAnalyzer, WordBaseRecord } from "./dbAnalyzer"
import { CollocationRecord } from "./collocationMatcher"

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