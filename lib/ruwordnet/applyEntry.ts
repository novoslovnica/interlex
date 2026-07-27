// Чистая логика применения одной обогащённой RuWordNet-записи — без побочных
// эффектов при импорте (никакого dotenv/env-мутирования/автозапуска), в
// отличие от scripts/db/upload-ruwordnet.ts (CLI-скрипт с process.env-сайд-
// эффектами на верхнем уровне). Используется и батчем (scripts/db/
// upload-ruwordnet.ts), и живой кнопкой одного слова
// (app/api/admin/words/[id]/match-ruwordnet/route.ts) — держим здесь, а не в
// scripts/, чтобы app-роут не импортировал CLI-скрипт напрямую.

export interface SynsetEntry {
  synsetId: string
  synsetExternalId?: string
  definition?: string
  domains?: string
  partOfSpeech?: string
}

export interface RelationEntry {
  hypernyms: string[]
  hyponyms: string[]
  meronyms: string[]
  holonyms: string[]
  related: string[]
  posSynonyms: string[]
  instanceOfClasses: string[]
  hasInstances: string[]
  derivationTargets: string[]
  derivationSources: string[]
  premises?: string[]
  conclusions?: string[]
  causes?: string[]
  effects?: string[]
}

export interface EnrichedEntry {
  meaningId: number
  wordId: number
  isvWord: string
  synonyms: string[]
  antonyms: string[]
  synsets: SynsetEntry[]
  synset_data_list: RelationEntry[]
}

type DirectionKey = keyof RelationEntry

interface RelationRule {
  relationType: string
  symmetric: boolean
  // Only meaningful when symmetric is false:
  // "entryIsSource" -> (sourceId=entry.meaningId, targetId=lookup(word))
  // "entryIsTarget" -> (sourceId=lookup(word), targetId=entry.meaningId)
  direction?: "entryIsSource" | "entryIsTarget"
}

// See AGENTS.md "Semantic Network" for the exact per-type source/target
// convention this mirrors (source=specific/dependent, target=general/governing).
const RELATION_RULES: Record<DirectionKey, RelationRule> = {
  hypernyms: { relationType: "hypernymy", symmetric: false, direction: "entryIsSource" },
  hyponyms: { relationType: "hypernymy", symmetric: false, direction: "entryIsTarget" },
  meronyms: { relationType: "meronymy", symmetric: false, direction: "entryIsTarget" },
  holonyms: { relationType: "meronymy", symmetric: false, direction: "entryIsSource" },
  related: { relationType: "related", symmetric: true },
  posSynonyms: { relationType: "pos_synonym", symmetric: true },
  instanceOfClasses: { relationType: "instance_of", symmetric: false, direction: "entryIsSource" },
  hasInstances: { relationType: "instance_of", symmetric: false, direction: "entryIsTarget" },
  derivationTargets: { relationType: "derivation", symmetric: false, direction: "entryIsSource" },
  derivationSources: { relationType: "derivation", symmetric: false, direction: "entryIsTarget" },
  premises: { relationType: "entailment", symmetric: false, direction: "entryIsTarget" },
  conclusions: { relationType: "entailment", symmetric: false, direction: "entryIsSource" },
  causes: { relationType: "causation", symmetric: false, direction: "entryIsTarget" },
  effects: { relationType: "causation", symmetric: false, direction: "entryIsSource" },
}

export const RUWORDNET_SOURCE_TAG = "ruwordnet_auto"

export interface RelationRow {
  sourceId: number
  targetId: number
  relationType: string
}

export interface SynsetRow {
  synsetId: string
  synsetExternalId: string | null
  definition: string | null
  domains: string | null
  partOfSpeech: string | null
}

export interface LinkRow {
  meaningId: number
  synsetId: string
  source: string
  confidence: number
}

export interface ComputedEntryData {
  synsetRows: SynsetRow[]
  linkRows: LinkRow[]
  relationRows: Map<string, RelationRow>
}

/**
 * Вычисляет synsets/meaning_synset-связи и дедуплицированные
 * semantic_relations для ОДНОГО обогащённого entry (без обращения к БД на
 * запись) — общая логика для батча и live-кнопки одного слова.
 */
export function computeEntryData(entry: EnrichedEntry, ruLookup: Map<string, number>): ComputedEntryData {
  const synsetRows: SynsetRow[] = (entry.synsets ?? []).map((s) => ({
    synsetId: s.synsetId,
    synsetExternalId: s.synsetExternalId ?? null,
    definition: s.definition ?? null,
    domains: s.domains ?? null,
    partOfSpeech: s.partOfSpeech ?? null,
  }))

  const linkRows: LinkRow[] = (entry.synsets ?? []).map((s) => ({
    meaningId: entry.meaningId,
    synsetId: s.synsetId,
    source: RUWORDNET_SOURCE_TAG,
    confidence: 1.0,
  }))

  const relationRows = new Map<string, RelationRow>()

  function addRelation(sourceId: number, targetId: number, relationType: string) {
    if (sourceId === targetId) return
    const key = `${sourceId},${targetId},${relationType}`
    relationRows.set(key, { sourceId, targetId, relationType })
  }

  function addSymmetric(a: number, b: number, relationType: string) {
    addRelation(Math.min(a, b), Math.max(a, b), relationType)
  }

  for (const word of entry.synonyms ?? []) {
    const otherId = ruLookup.get(word)
    if (otherId !== undefined) addSymmetric(entry.meaningId, otherId, "synonym")
  }
  for (const word of entry.antonyms ?? []) {
    const otherId = ruLookup.get(word)
    if (otherId !== undefined) addSymmetric(entry.meaningId, otherId, "antonym")
  }

  for (const synsetData of entry.synset_data_list ?? []) {
    for (const [jsonKey, rule] of Object.entries(RELATION_RULES) as [DirectionKey, RelationRule][]) {
      const words = synsetData[jsonKey] as string[] | undefined
      if (!words || words.length === 0) continue

      for (const word of words) {
        const otherId = ruLookup.get(word)
        if (otherId === undefined) continue

        if (rule.symmetric) {
          addSymmetric(entry.meaningId, otherId, rule.relationType)
        } else if (rule.direction === "entryIsSource") {
          addRelation(entry.meaningId, otherId, rule.relationType)
        } else {
          addRelation(otherId, entry.meaningId, rule.relationType)
        }
      }
    }
  }

  return { synsetRows, linkRows, relationRows }
}

// better-sqlite3 Database — типизируем как unknown-friendly any, чтобы не
// тянуть зависимость от конкретного места объявления типа (см. lib/sqlite.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqliteDb = any

/** Additive: INSERT OR IGNORE — безопасно вызывать сколько угодно раз, для батча и для одного слова одинаково. */
export function applySynsetsAndLinks(
  dbSimple: SqliteDb,
  synsetRows: SynsetRow[],
  linkRows: LinkRow[],
): { synsetsCreated: number; synsetsSkipped: number; linksCreated: number; linksSkipped: number } {
  const insertSynset = dbSimple.prepare(`
    insert or ignore into synsets ("synsetId", synset_external_id, definition, domains, part_of_speech)
    values (?, ?, ?, ?, ?)
  `)
  const insertLink = dbSimple.prepare(`
    insert or ignore into meanings_synsets ("meaningId", "synsetId", source, confidence)
    values (?, ?, ?, ?)
  `)

  let synsetsCreated = 0
  let synsetsSkipped = 0
  let linksCreated = 0
  let linksSkipped = 0

  const tx = dbSimple.transaction(() => {
    for (const s of synsetRows) {
      const result = insertSynset.run(s.synsetId, s.synsetExternalId, s.definition, s.domains, s.partOfSpeech)
      if (result.changes > 0) synsetsCreated++
      else synsetsSkipped++
    }
    for (const l of linkRows) {
      const result = insertLink.run(l.meaningId, l.synsetId, l.source, l.confidence)
      if (result.changes > 0) linksCreated++
      else linksSkipped++
    }
  })
  tx()

  return { synsetsCreated, synsetsSkipped, linksCreated, linksSkipped }
}

/**
 * Скоуп-ограниченная запись semantic_relations для ОДНОГО слова (live-кнопка,
 * app/api/admin/words/[id]/match-ruwordnet/route.ts): удаляет только
 * source='ruwordnet_auto' строки, где sourceId/targetId = meaningId этого
 * слова, затем вставляет свежевычисленные. НЕ трогает auto-связи других
 * слов и НИКОГДА не трогает source='manual'. В отличие от батчевого
 * глобального DELETE (scripts/db/upload-ruwordnet.ts) — тот проходит по всей
 * таблице разом, что было бы разрушительно при вызове на каждый клик кнопки.
 */
export function applyRelationsScoped(dbSimple: SqliteDb, meaningId: number, relationRows: Map<string, RelationRow>): number {
  const insertRelation = dbSimple.prepare(`
    INSERT OR IGNORE INTO semantic_relations (sourceId, targetId, relation_type, source)
    VALUES (?, ?, ?, ?)
  `)

  let inserted = 0
  const tx = dbSimple.transaction(() => {
    dbSimple
      .prepare(`DELETE FROM semantic_relations WHERE source = ? AND (sourceId = ? OR targetId = ?)`)
      .run(RUWORDNET_SOURCE_TAG, meaningId, meaningId)
    for (const row of relationRows.values()) {
      const result = insertRelation.run(row.sourceId, row.targetId, row.relationType, RUWORDNET_SOURCE_TAG)
      if (result.changes > 0) inserted++
    }
  })
  tx()

  return inserted
}
