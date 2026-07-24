import { prismaLibrary as db } from "@/lib/prisma"

export function readingStats(bodyLength: number) {
  return {
    minutes: Math.max(1, Math.round(bodyLength / 1000)),
    pages: Math.max(1, Math.ceil(bodyLength / 1800)),
  }
}

// Sums bodyLength across an entry and all of its descendants (collections can nest).
export async function getCollectionBodyLength(entryId: number): Promise<number> {
  const rows = await db.$queryRaw<{ total: number | bigint }[]>`
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM "LibraryEntry" WHERE id = ${entryId}
      UNION ALL
      SELECT le.id FROM "LibraryEntry" le JOIN descendants d ON le."parentId" = d.id
    )
    SELECT COALESCE(SUM("bodyLength"), 0) AS total FROM "LibraryEntry" WHERE id IN (SELECT id FROM descendants)
  `
  return Number(rows[0]?.total ?? 0)
}

interface EntryNode {
  id: number
  parentId: number | null
  bodyLength: number
}

// Same aggregation as getCollectionBodyLength, but batched in memory for a full entry list
// (avoids one recursive query per row on the library listing page).
export function aggregateBodyLengths(entries: EntryNode[]): Map<number, number> {
  const childrenOf = new Map<number, number[]>()
  const bodyLengthOf = new Map<number, number>()
  for (const e of entries) {
    bodyLengthOf.set(e.id, e.bodyLength)
    if (e.parentId != null) {
      const list = childrenOf.get(e.parentId) ?? []
      list.push(e.id)
      childrenOf.set(e.parentId, list)
    }
  }

  const totals = new Map<number, number>()

  function computeTotal(id: number, visiting: Set<number>): number {
    const cached = totals.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return bodyLengthOf.get(id) ?? 0 // guard against a parentId cycle
    visiting.add(id)
    const own = bodyLengthOf.get(id) ?? 0
    const children = childrenOf.get(id) ?? []
    const total = own + children.reduce((sum, childId) => sum + computeTotal(childId, visiting), 0)
    visiting.delete(id)
    totals.set(id, total)
    return total
  }

  for (const e of entries) computeTotal(e.id, new Set())
  return totals
}
