import { init } from "@/lib/sqlite"
import { prismaData } from "@/lib/prisma"
import {
  fetchSymmetricSemanticRelations,
  fetchOutgoingSemanticRelations,
  fetchIncomingSemanticRelations,
} from "@/lib/relations"
import { RELATION_CONFIG } from "@/app/admin/relations/relation-config"

// Mirrors the ALL_RELATIONS list in app/admin/words/[id]/edit/page.tsx —
// synonym/antonym have their own dedicated admin pages so aren't part of
// RELATION_CONFIG, added here directly to keep this list complete.
const ALL_RELATIONS: { key: string; relationType: string; direction?: "outgoing" | "incoming" }[] = [
  { key: "synonym", relationType: "synonym" },
  { key: "antonym", relationType: "antonym" },
  ...Object.entries(RELATION_CONFIG).map(([key, cfg]) => ({
    key,
    relationType: cfg.relationType,
    direction: cfg.direction,
  })),
]

// For a target lexeme's meanings, checks which of the given collocate slugs
// already have a registered SemanticRelation edge to the target (any type),
// so the UI can distinguish "distributional collocate the moderator already
// linked" from "not yet linked" without auto-writing anything.
export async function crossReferenceRelations(
  targetSlug: string,
  collocateSlugs: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>(collocateSlugs.map((s) => [s, []]))
  if (collocateSlugs.length === 0) return result

  const [targetLexeme, collocateLexemes] = await Promise.all([
    prismaData.lexeme.findUnique({
      where: { slug: targetSlug },
      select: { meanings: { select: { id: true } } },
    }),
    prismaData.lexeme.findMany({
      where: { slug: { in: collocateSlugs } },
      select: { slug: true, meanings: { select: { id: true } } },
    }),
  ])

  const targetMeaningIds = (targetLexeme?.meanings ?? []).map((m) => m.id)
  if (targetMeaningIds.length === 0) return result

  const meaningIdsBySlug = new Map(
    collocateLexemes.map((l) => [l.slug, new Set(l.meanings.map((m) => m.id))]),
  )

  const db = await init()
  try {
    // For each relation type, collect the set of meaning IDs already linked
    // to any of the target's meanings, then check which collocates fall in it.
    const neighborsByKey = new Map<string, Set<number>>()
    for (const rel of ALL_RELATIONS) {
      const fetched = rel.direction === "outgoing"
        ? fetchOutgoingSemanticRelations(db, rel.relationType, targetMeaningIds)
        : rel.direction === "incoming"
          ? fetchIncomingSemanticRelations(db, rel.relationType, targetMeaningIds)
          : fetchSymmetricSemanticRelations(db, rel.relationType, targetMeaningIds)

      const neighbors = new Set<number>()
      for (const list of fetched.values()) {
        for (const item of list) neighbors.add(item.otherMeaningId)
      }
      neighborsByKey.set(rel.key, neighbors)
    }

    for (const slug of collocateSlugs) {
      const meaningIds = meaningIdsBySlug.get(slug)
      if (!meaningIds || meaningIds.size === 0) continue
      const matchedKeys: string[] = []
      for (const rel of ALL_RELATIONS) {
        const neighbors = neighborsByKey.get(rel.key)!
        if ([...meaningIds].some((id) => neighbors.has(id))) matchedKeys.push(rel.key)
      }
      result.set(slug, matchedKeys)
    }
  } finally {
    db.close()
  }

  return result
}
