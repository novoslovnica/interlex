import { prismaData } from "@/lib/prisma"
import { DbAnalyzer, WordBaseRecord } from "./dbAnalyzer"

export async function buildValidEndings(): Promise<Set<string>> {
  const rows = await prismaData.endingAllophone.findMany({
    select: { value: true },
  })
  const endings = new Set<string>(rows.map((r) => r.value))
  endings.add("")
  return endings
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
    }))
  }
}