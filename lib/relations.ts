import type Database from "better-sqlite3"

/**
 * The 11 relation tables (synonyms, antonyms, hypernyms, ...) store an
 * undirected edge between two Meanings as one row with sourceId/targetId.
 * Which column holds which side is storage detail, not semantics — linking
 * meaning A to meaning B must be visible and editable from either A's or B's
 * side. These helpers treat sourceId/targetId as unordered everywhere the
 * tables are read or written, instead of only ever looking at sourceId.
 */

export interface RelatedMeaning {
  relationId: number
  otherMeaningId: number
  otherMeaning: string | null
  otherWordId: number | null
  otherWord: string | null
  proximity: number | null
}

export function fetchSymmetricRelations(
  db: Database.Database,
  table: string,
  meaningIds: number[]
): Map<number, RelatedMeaning[]> {
  const result = new Map<number, RelatedMeaning[]>()
  for (const id of meaningIds) result.set(id, [])
  if (meaningIds.length === 0) return result

  const placeholders = meaningIds.map(() => "?").join(",")
  const rows = db.prepare(`
    SELECT id AS relationId, sourceId, targetId, proximity
    FROM ${table}
    WHERE sourceId IN (${placeholders}) OR targetId IN (${placeholders})
  `).all(...meaningIds, ...meaningIds) as {
    relationId: number
    sourceId: number
    targetId: number
    proximity: number | null
  }[]

  const idSet = new Set(meaningIds)
  const pending: { meaningId: number; relationId: number; otherMeaningId: number; proximity: number | null }[] = []
  const otherIdsNeeded = new Set<number>()

  for (const row of rows) {
    if (idSet.has(row.sourceId)) {
      pending.push({ meaningId: row.sourceId, relationId: row.relationId, otherMeaningId: row.targetId, proximity: row.proximity })
      otherIdsNeeded.add(row.targetId)
    }
    // A row can touch two requested meanings at once (e.g. two meanings of the
    // same word related to each other) — handle both sides independently.
    if (row.sourceId !== row.targetId && idSet.has(row.targetId)) {
      pending.push({ meaningId: row.targetId, relationId: row.relationId, otherMeaningId: row.sourceId, proximity: row.proximity })
      otherIdsNeeded.add(row.sourceId)
    }
  }

  const otherInfo = new Map<number, { meaning: string | null; wordId: number | null; word: string | null }>()
  if (otherIdsNeeded.size > 0) {
    const otherIds = [...otherIdsNeeded]
    const otherPlaceholders = otherIds.map(() => "?").join(",")
    const infoRows = db.prepare(`
      SELECT m.id AS meaningId, m.meaning, l.id AS wordId, l.value AS word
      FROM meanings m
      JOIN lexemes l ON l.id = m.lexemeId
      WHERE m.id IN (${otherPlaceholders})
    `).all(...otherIds) as { meaningId: number; meaning: string | null; wordId: number; word: string | null }[]
    for (const r of infoRows) {
      otherInfo.set(r.meaningId, { meaning: r.meaning, wordId: r.wordId, word: r.word })
    }
  }

  for (const p of pending) {
    const info = otherInfo.get(p.otherMeaningId)
    result.get(p.meaningId)!.push({
      relationId: p.relationId,
      otherMeaningId: p.otherMeaningId,
      otherMeaning: info?.meaning ?? null,
      otherWordId: info?.wordId ?? null,
      otherWord: info?.word ?? null,
      proximity: p.proximity,
    })
  }

  return result
}

/**
 * Replaces meaningId's set of related meanings in `table` with exactly
 * `targetMeaningIds`, storing each edge once regardless of which side ends
 * up in sourceId vs targetId. Existing edges (in either direction) that are
 * no longer in the target list are deleted; new ones are inserted once.
 */
export function saveSymmetricRelation(
  db: Database.Database,
  table: string,
  meaningId: number,
  targetMeaningIds: number[],
  proximity: number | null = null
): void {
  const targetSet = new Set(targetMeaningIds)

  const existing = db.prepare(`
    SELECT id, sourceId, targetId FROM ${table} WHERE sourceId = ? OR targetId = ?
  `).all(meaningId, meaningId) as { id: number; sourceId: number; targetId: number }[]

  const currentOtherToRowId = new Map<number, number>()
  for (const row of existing) {
    const other = row.sourceId === meaningId ? row.targetId : row.sourceId
    currentOtherToRowId.set(other, row.id)
  }

  const toRemove = [...currentOtherToRowId.keys()].filter((id) => !targetSet.has(id))
  const toAdd = [...targetSet].filter((id) => !currentOtherToRowId.has(id) && id !== meaningId)

  const tx = db.transaction(() => {
    if (toRemove.length > 0) {
      const del = db.prepare(`DELETE FROM ${table} WHERE id = ?`)
      for (const otherId of toRemove) {
        del.run(currentOtherToRowId.get(otherId)!)
      }
    }
    if (toAdd.length > 0) {
      const insert = db.prepare(`INSERT INTO ${table} (sourceId, targetId, proximity) VALUES (?, ?, ?)`)
      for (const otherId of toAdd) {
        insert.run(meaningId, otherId, proximity)
      }
    }
  })
  tx()
}
