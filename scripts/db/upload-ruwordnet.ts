import * as path from "path"
import fs from "fs"
import { init } from "@/lib/sqlite"
import dotenv from "dotenv"
import {
  EnrichedEntry,
  RelationRow,
  SynsetRow,
  LinkRow,
  RUWORDNET_SOURCE_TAG,
  computeEntryData,
  applySynsetsAndLinks,
} from "@/lib/ruwordnet/applyEntry"

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") })
process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`

// Единый скрипт загрузки данных RuWordNet (2026-07-23). Заменяет
// upload-synsets.ts + upload-synonyms-antonyms.ts + upload-synset-relations.ts.
// Читает words_enriched.json (формат из переписанного process_words.py —
// synset_data_list вместо synset_data, см. AGENTS.md "Semantic Network").
//
// 2026-07-28: entry-уровневая логика (computeEntryData/applySynsetsAndLinks)
// вынесена в lib/ruwordnet/applyEntry.ts — её же использует
// app/api/admin/words/[id]/match-ruwordnet/route.ts для живого сопоставления
// ОДНОГО слова (через applyRelationsScoped — скоуп-ограниченный DELETE только
// по строкам этого meaningId). Батч ниже поведения не изменил: по-прежнему
// один глобальный DELETE+bulk-INSERT по всей таблице semantic_relations —
// для одного слова это было бы разрушительно (стёрло бы auto-связи всех
// остальных слов), поэтому у live-кнопки отдельная, узкая запись.
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

async function main() {
  const { prismaData: db } = await import("@/lib/prisma")

  const inputPath = path.resolve(process.cwd(), "./scripts/python/words_enriched.json")
  const data: EnrichedEntry[] = JSON.parse(fs.readFileSync(inputPath, "utf-8"))

  const dbSimple = await init()

  const validMeaningIds = new Set(
    dbSimple.prepare("SELECT id FROM meanings").all().map((r: any) => r.id)
  )
  console.error(`Valid meaningIds in DB: ${validMeaningIds.size}`)

  // "ru" был отдельной таблицей до консолидации 18 языковых таблиц в
  // единую translations (2026-07-23) — с тех пор переводы фильтруются по
  // language='ru' (см. lib/translations.ts).
  const ruLookup = new Map<string, number>()
  for (const row of dbSimple
    .prepare(`SELECT value, meaningId FROM translations WHERE language = 'ru' AND value IS NOT NULL AND meaningId IS NOT NULL`)
    .all() as { value: string; meaningId: number }[]) {
    ruLookup.set(row.value, row.meaningId)
  }
  console.error(`Loaded ${ruLookup.size} ru entries`)

  const allSynsetRows: SynsetRow[] = []
  const allLinkRows: LinkRow[] = []
  // Батч по-прежнему копит ОДИН общий Map по всему файлу и пишет его ОДНИМ
  // глобальным DELETE+bulk-INSERT в конце — не изменилось при вынесении
  // computeEntryData в общий модуль.
  const globalRelationRows = new Map<string, RelationRow>()

  for (const entry of data) {
    if (!entry.meaningId || !validMeaningIds.has(entry.meaningId)) continue

    const computed = computeEntryData(entry, ruLookup)
    allSynsetRows.push(...computed.synsetRows)
    allLinkRows.push(...computed.linkRows)
    for (const [key, row] of computed.relationRows) {
      globalRelationRows.set(key, row)
    }
  }

  const { synsetsCreated, synsetsSkipped, linksCreated, linksSkipped } = applySynsetsAndLinks(dbSimple, allSynsetRows, allLinkRows)

  console.error(`Collected ${globalRelationRows.size} unique semantic_relations rows`)

  const insertRelation = dbSimple.prepare(`
    INSERT OR IGNORE INTO semantic_relations (sourceId, targetId, relation_type, source)
    VALUES (?, ?, ?, ?)
  `)

  const writeRelations = dbSimple.transaction(() => {
    // Scoped delete: only remove rows this script previously wrote —
    // never touches source='manual' rows from the admin UI.
    dbSimple.prepare(`DELETE FROM semantic_relations WHERE source = ?`).run(RUWORDNET_SOURCE_TAG)
    let inserted = 0
    for (const row of globalRelationRows.values()) {
      const result = insertRelation.run(row.sourceId, row.targetId, row.relationType, RUWORDNET_SOURCE_TAG)
      if (result.changes > 0) inserted++
    }
    console.error(`Inserted ${inserted} semantic_relations rows (source='${RUWORDNET_SOURCE_TAG}')`)
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
