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

/**
 * Everything below operates on the consolidated `semantic_relations` table
 * (2026-07-23, see AGENTS.md "Semantic Network"), which replaces the 11
 * tables above for new data. `relationType` takes the place of `table`.
 * The 11-table functions above are left untouched — the admin UI still
 * reads/writes them until it's migrated (deferred, see AGENTS.md TODO).
 *
 * Symmetric types (order doesn't matter — synonym/antonym/related/
 * pos_synonym): sourceId/targetId are normalized to (min, max) on write so
 * the (sourceId, targetId, relationType) unique index dedupes correctly
 * regardless of which side a caller passes first.
 *
 * Directional types (hypernymy/meronymy/causation/entailment/instance_of/
 * derivation): sourceId is always the specific/dependent side, targetId the
 * general/governing side (see AGENTS.md for the exact per-type convention).
 * Use fetchOutgoingSemanticRelations/fetchIncomingSemanticRelations and
 * saveDirectionalSemanticRelation for these instead.
 */

export interface SaveRelationOptions {
  source?: string
}

export function fetchSymmetricSemanticRelations(
  db: Database.Database,
  relationType: string,
  meaningIds: number[]
): Map<number, RelatedMeaning[]> {
  const result = new Map<number, RelatedMeaning[]>()
  for (const id of meaningIds) result.set(id, [])
  if (meaningIds.length === 0) return result

  const placeholders = meaningIds.map(() => "?").join(",")
  const rows = db.prepare(`
    SELECT id AS relationId, sourceId, targetId, proximity
    FROM semantic_relations
    WHERE relation_type = ? AND (sourceId IN (${placeholders}) OR targetId IN (${placeholders}))
  `).all(relationType, ...meaningIds, ...meaningIds) as {
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
 * Replaces meaningId's set of symmetric-type relations with exactly
 * `targetMeaningIds`, normalizing (sourceId, targetId) to (min, max) so the
 * edge is stored once regardless of call order. Defaults `source: 'manual'`
 * — pass `{ source: 'ruwordnet_auto' }` from import scripts only.
 */
export function saveSymmetricSemanticRelation(
  db: Database.Database,
  relationType: string,
  meaningId: number,
  targetMeaningIds: number[],
  proximity: number | null = null,
  opts: SaveRelationOptions = {}
): void {
  const source = opts.source ?? "manual"
  const targetSet = new Set(targetMeaningIds)

  const existing = db.prepare(`
    SELECT id, sourceId, targetId FROM semantic_relations WHERE relation_type = ? AND (sourceId = ? OR targetId = ?)
  `).all(relationType, meaningId, meaningId) as { id: number; sourceId: number; targetId: number }[]

  const currentOtherToRowId = new Map<number, number>()
  for (const row of existing) {
    const other = row.sourceId === meaningId ? row.targetId : row.sourceId
    currentOtherToRowId.set(other, row.id)
  }

  const toRemove = [...currentOtherToRowId.keys()].filter((id) => !targetSet.has(id))
  const toAdd = [...targetSet].filter((id) => !currentOtherToRowId.has(id) && id !== meaningId)

  const tx = db.transaction(() => {
    if (toRemove.length > 0) {
      const del = db.prepare(`DELETE FROM semantic_relations WHERE id = ?`)
      for (const otherId of toRemove) {
        del.run(currentOtherToRowId.get(otherId)!)
      }
    }
    if (toAdd.length > 0) {
      const insert = db.prepare(`
        INSERT INTO semantic_relations (sourceId, targetId, relation_type, proximity, source)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const otherId of toAdd) {
        const sourceId = Math.min(meaningId, otherId)
        const targetId = Math.max(meaningId, otherId)
        insert.run(sourceId, targetId, relationType, proximity, source)
      }
    }
  })
  tx()
}

/** Rows where `meaningId` is the source side (e.g. "hypernyms of X" for relationType='hypernymy'). */
export function fetchOutgoingSemanticRelations(
  db: Database.Database,
  relationType: string,
  meaningIds: number[]
): Map<number, RelatedMeaning[]> {
  return fetchDirectionalSemanticRelations(db, relationType, meaningIds, "outgoing")
}

/** Rows where `meaningId` is the target side (e.g. "hyponyms of X" for relationType='hypernymy'). */
export function fetchIncomingSemanticRelations(
  db: Database.Database,
  relationType: string,
  meaningIds: number[]
): Map<number, RelatedMeaning[]> {
  return fetchDirectionalSemanticRelations(db, relationType, meaningIds, "incoming")
}

function fetchDirectionalSemanticRelations(
  db: Database.Database,
  relationType: string,
  meaningIds: number[],
  direction: "outgoing" | "incoming"
): Map<number, RelatedMeaning[]> {
  const result = new Map<number, RelatedMeaning[]>()
  for (const id of meaningIds) result.set(id, [])
  if (meaningIds.length === 0) return result

  const ownColumn = direction === "outgoing" ? "sourceId" : "targetId"
  const otherColumn = direction === "outgoing" ? "targetId" : "sourceId"

  const placeholders = meaningIds.map(() => "?").join(",")
  const rows = db.prepare(`
    SELECT id AS relationId, ${ownColumn} AS ownId, ${otherColumn} AS otherId, proximity
    FROM semantic_relations
    WHERE relation_type = ? AND ${ownColumn} IN (${placeholders})
  `).all(relationType, ...meaningIds) as { relationId: number; ownId: number; otherId: number; proximity: number | null }[]

  const otherIdsNeeded = new Set(rows.map((r) => r.otherId))
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

  for (const row of rows) {
    const info = otherInfo.get(row.otherId)
    result.get(row.ownId)!.push({
      relationId: row.relationId,
      otherMeaningId: row.otherId,
      otherMeaning: info?.meaning ?? null,
      otherWordId: info?.wordId ?? null,
      otherWord: info?.word ?? null,
      proximity: row.proximity,
    })
  }

  return result
}

/**
 * Replaces the edges on one side of `meaningId` (its outgoing or incoming
 * side, per `direction`) with exactly `otherMeaningIds`, for a directional
 * relationType. E.g. direction='outgoing' with relationType='hypernymy'
 * replaces X's hypernyms; direction='incoming' replaces X's hyponyms.
 * Defaults `source: 'manual'` — pass `{ source: 'ruwordnet_auto' }` from
 * import scripts only.
 */
export function saveDirectionalSemanticRelation(
  db: Database.Database,
  relationType: string,
  meaningId: number,
  direction: "outgoing" | "incoming",
  otherMeaningIds: number[],
  proximity: number | null = null,
  opts: SaveRelationOptions = {}
): void {
  const source = opts.source ?? "manual"
  const ownColumn = direction === "outgoing" ? "sourceId" : "targetId"
  const otherColumn = direction === "outgoing" ? "targetId" : "sourceId"
  const otherSet = new Set(otherMeaningIds)

  const existing = db.prepare(`
    SELECT id, ${otherColumn} AS otherId FROM semantic_relations WHERE relation_type = ? AND ${ownColumn} = ?
  `).all(relationType, meaningId) as { id: number; otherId: number }[]

  const currentOtherToRowId = new Map<number, number>()
  for (const row of existing) currentOtherToRowId.set(row.otherId, row.id)

  const toRemove = [...currentOtherToRowId.keys()].filter((id) => !otherSet.has(id))
  const toAdd = [...otherSet].filter((id) => !currentOtherToRowId.has(id) && id !== meaningId)

  const tx = db.transaction(() => {
    if (toRemove.length > 0) {
      const del = db.prepare(`DELETE FROM semantic_relations WHERE id = ?`)
      for (const otherId of toRemove) {
        del.run(currentOtherToRowId.get(otherId)!)
      }
    }
    if (toAdd.length > 0) {
      const insert = db.prepare(`
        INSERT INTO semantic_relations (sourceId, targetId, relation_type, proximity, source)
        VALUES (?, ?, ?, ?, ?)
      `)
      for (const otherId of toAdd) {
        const sourceId = direction === "outgoing" ? meaningId : otherId
        const targetId = direction === "outgoing" ? otherId : meaningId
        insert.run(sourceId, targetId, relationType, proximity, source)
      }
    }
  })
  tx()
}
