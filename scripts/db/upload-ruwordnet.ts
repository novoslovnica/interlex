import * as path from "path"
import fs from "fs"
import { init } from "@/lib/sqlite"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") })
process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

// Единый скрипт загрузки данных RuWordNet (2026-07-23). Заменяет
// upload-synsets.ts + upload-synonyms-antonyms.ts + upload-synset-relations.ts.
// Читает words_enriched.json (формат из переписанного process_words.py —
// synset_data_list вместо synset_data, см. AGENTS.md "Semantic Network").
//
// Fixes:
//   - Bug B (upload-synonyms-antonyms.ts): голый INSERT без проверки
//     существования плодил дубликаты при повторных запусках. Здесь все
//     строки сначала собираются в Set по (sourceId,targetId,relationType),
//     затем один раз вставляются с уникальным индексом как второй линией
//     защиты.
//   - Деструктивный DELETE FROM <table> (upload-synset-relations.ts):
//     реимпорт удаляет только строки source='ruwordnet_auto' в
//     semantic_relations, ручные правки модератора (source='manual') не
//     трогаются.
//
// Usage:
//   npx tsx scripts/db/upload-ruwordnet.ts

interface SynsetEntry {
  synsetId: string
  synsetExternalId?: string
  definition?: string
  domains?: string
  partOfSpeech?: string
}

interface RelationEntry {
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

interface EnrichedEntry {
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

const SOURCE_TAG = "ruwordnet_auto"

async function main() {
  const { prismaData: db } = await import("@/lib/prisma")

  const inputPath = path.resolve(process.cwd(), "./scripts/python/words_enriched.json")
  const data: EnrichedEntry[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"))

  const dbSimple = await init()

  const validMeaningIds = new Set(
    dbSimple.prepare("SELECT id FROM meanings").all().map((r: any) => r.id)
  )
  console.error(`Valid meaningIds in DB: ${validMeaningIds.size}`)

  const ruLookup = new Map<string, number>()
  for (const row of dbSimple.prepare(`SELECT value, meaningId FROM ru`).all() as { value: string; meaningId: number }[]) {
    ruLookup.set(row.value, row.meaningId)
  }
  console.error(`Loaded ${ruLookup.size} ru entries`)

  // --- Synsets / MeaningSynset (unchanged logic from upload-synsets.ts) ---
  let synsetsCreated = 0
  let synsetsSkipped = 0
  let linksCreated = 0
  let linksSkipped = 0

  const insertSynset = dbSimple.prepare(`
    insert or ignore into synsets ("synsetId", synset_external_id, definition, domains, part_of_speech)
    values (?, ?, ?, ?, ?)
  `)
  const insertLink = dbSimple.prepare(`
    insert or ignore into meanings_synsets ("meaningId", "synsetId", source, confidence)
    values (?, ?, ?, ?)
  `)

  // --- Semantic relations: collect into a dedup Set keyed by (sourceId,targetId,relationType) ---
  const relationRows = new Map<string, { sourceId: number; targetId: number; relationType: string }>()

  function addRelation(sourceId: number, targetId: number, relationType: string) {
    if (sourceId === targetId) return
    const key = `${sourceId},${targetId},${relationType}`
    relationRows.set(key, { sourceId, targetId, relationType })
  }

  function addSymmetric(a: number, b: number, relationType: string) {
    addRelation(Math.min(a, b), Math.max(a, b), relationType)
  }

  const insertSynsetTx = dbSimple.transaction((entries: { synsetId: string; synsetExternalId: string | null; definition: string | null; domains: string | null; partOfSpeech: string | null }[]) => {
    for (const e of entries) {
      const result = insertSynset.run(e.synsetId, e.synsetExternalId, e.definition, e.domains, e.partOfSpeech)
      if (result.changes > 0) synsetsCreated++
      else synsetsSkipped++
    }
  })

  const insertLinkTx = dbSimple.transaction((entries: { meaningId: number; synsetId: string; source: string; confidence: number }[]) => {
    for (const e of entries) {
      const result = insertLink.run(e.meaningId, e.synsetId, e.source, e.confidence)
      if (result.changes > 0) linksCreated++
      else linksSkipped++
    }
  })

  for (const entry of data) {
    if (!entry.meaningId || !validMeaningIds.has(entry.meaningId)) continue

    // Synsets + MeaningSynset
    if (entry.synsets?.length) {
      const synsetRows = entry.synsets.map((s) => ({
        synsetId: s.synsetId,
        synsetExternalId: s.synsetExternalId ?? null,
        definition: s.definition ?? null,
        domains: s.domains ?? null,
        partOfSpeech: s.partOfSpeech ?? null,
      }))
      insertSynsetTx(synsetRows)

      const linkRows = entry.synsets.map((s) => ({
        meaningId: entry.meaningId,
        synsetId: s.synsetId,
        source: SOURCE_TAG,
        confidence: 1.0,
      }))
      insertLinkTx(linkRows)
    }

    // Top-level synonyms/antonyms (symmetric)
    for (const word of entry.synonyms ?? []) {
      const otherId = ruLookup.get(word)
      if (otherId !== undefined) addSymmetric(entry.meaningId, otherId, "synonym")
    }
    for (const word of entry.antonyms ?? []) {
      const otherId = ruLookup.get(word)
      if (otherId !== undefined) addSymmetric(entry.meaningId, otherId, "antonym")
    }

    // Per-synset relation lists
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
  }

  console.error(`Collected ${relationRows.size} unique semantic_relations rows`)

  const insertRelation = dbSimple.prepare(`
    INSERT OR IGNORE INTO semantic_relations (sourceId, targetId, relation_type, source)
    VALUES (?, ?, ?, ?)
  `)

  const writeRelations = dbSimple.transaction(() => {
    // Scoped delete: only remove rows this script previously wrote —
    // never touches source='manual' rows from the admin UI.
    dbSimple.prepare(`DELETE FROM semantic_relations WHERE source = ?`).run(SOURCE_TAG)
    let inserted = 0
    for (const row of relationRows.values()) {
      const result = insertRelation.run(row.sourceId, row.targetId, row.relationType, SOURCE_TAG)
      if (result.changes > 0) inserted++
    }
    console.error(`Inserted ${inserted} semantic_relations rows (source='${SOURCE_TAG}')`)
  })

  writeRelations()

  console.error(`Synsets: ${synsetsCreated} created, ${synsetsSkipped} skipped`)
  console.error(`Links: ${linksCreated} created, ${linksSkipped} skipped`)
  await db.$disconnect()
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
