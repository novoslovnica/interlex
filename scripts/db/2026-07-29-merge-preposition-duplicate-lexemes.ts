import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"

// Находит лексемы с одинаковым (value, pos), различающиеся только тем, что
// исторически были заведены отдельными записями под конкретный предлог
// (вместо одной лексемы с несколькими значениями, каждое со своим
// ValencyArgument.prepositionLexemeId — см. Фазу 1 этой работы,
// scripts/db/2026-07-29-add-valency-preposition-lexeme-fk.ts), и сливает их.
//
// В отличие от lib/dedup/mergeLexemes.ts (используется в /admin/deduplication
// для ручного слияния через UI), этот скрипт НЕ схлопывает значения (meanings)
// в одно — каждое значение переносится под целевую лексему отдельной строкой,
// сохраняя свою собственную связь с предлогом. lib/dedup/mergeLexemes.ts для
// этого не подходит: он находит/создаёт одно значение на лексему-цель и
// удаляет остальные (rewireMeaningId + DELETE FROM meanings), что стёрло бы
// именно то различие, которое мы хотим сохранить.
//
// Критерий кандидата на слияние: совпадение (value, pos) у 2+ лексем, и хотя
// бы у одной из них есть предлог на ValencyArgument (prepositionLexemeId
// теперь, либо старый свободный текст preposition — на случай ещё
// немигрированных записей).
//
// Целевая лексема в группе — с наибольшим числом заполненных грамматических
// полей (richness), при равенстве — с наименьшим id. Только её собственные
// скалярные поля (stem/paradigm/...) переживают слияние; поля остальных
// участников группы отбрасываются вместе с самими лексемами (их значения
// при этом сохраняются, просто переезжают под цель).
//
// По умолчанию — dry-run (только отчёт, ничего не меняет). Реальное
// слияние — только с флагом --apply, отдельным запуском после проверки
// отчёта (см. обсуждение с мейнтейнером 2026-07-29).
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-29-merge-preposition-duplicate-lexemes.ts
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-29-merge-preposition-duplicate-lexemes.ts --apply

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:merge-preposition-duplicate-lexemes"

console.log(`Target DB: ${DB_PATH}`)
console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (read-only)"}\n`)

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

interface LexemeRow {
  id: number
  slug: string
  value: string | null
  pos: string | null
  stem: string | null
  secondaryStem: string | null
  tertiaryStem: string | null
  gender: string | null
  paradigm: string | null
  protoStemClass: string | null
  stemExtension: string | null
  declension: number | null
  conjugation: number | null
  aspect: string | null
  transitivity: string | null
  animacy: string | null
  degree: string | null
  pronType: string | null
  numType: string | null
  etymology: string | null
  proto: string | null
}

const RICHNESS_FIELDS: (keyof LexemeRow)[] = [
  "stem", "secondaryStem", "tertiaryStem", "gender", "paradigm", "protoStemClass",
  "stemExtension", "declension", "conjugation", "aspect", "transitivity", "animacy",
  "degree", "pronType", "numType", "etymology", "proto",
]

function richness(l: LexemeRow): number {
  return RICHNESS_FIELDS.reduce((n, f) => n + (l[f] !== null && l[f] !== "" ? 1 : 0), 0)
}

const getLexeme = db.prepare(`SELECT * FROM lexemes WHERE id = ?`)
const getMeaningsCount = db.prepare(`SELECT COUNT(*) c FROM meanings WHERE lexemeId = ?`)
const hasPrepositionStmt = db.prepare(`
  SELECT COUNT(*) c
  FROM valency_arguments va
  JOIN valency_frames vf ON vf.id = va.frameId
  JOIN meanings m ON m.id = vf.meaningId
  WHERE m.lexemeId = ?
    AND (va.prepositionLexemeId IS NOT NULL OR (va.preposition IS NOT NULL AND va.preposition != ''))
`)

interface CandidateGroup {
  value: string
  pos: string
  members: LexemeRow[]
  target: LexemeRow
  sources: LexemeRow[]
}

function findCandidates(): CandidateGroup[] {
  const groups = db.prepare(`
    SELECT value, pos, COUNT(*) as cnt
    FROM lexemes
    WHERE value IS NOT NULL AND value != '' AND pos IS NOT NULL
    GROUP BY value, pos
    HAVING cnt > 1
  `).all() as { value: string; pos: string; cnt: number }[]

  const candidates: CandidateGroup[] = []

  for (const g of groups) {
    const memberIds = (db.prepare(`SELECT id FROM lexemes WHERE value = ? AND pos = ?`).all(g.value, g.pos) as { id: number }[]).map((r) => r.id)
    const hasPrep = memberIds.some((id) => (hasPrepositionStmt.get(id) as { c: number }).c > 0)
    if (!hasPrep) continue

    const members = memberIds.map((id) => getLexeme.get(id) as LexemeRow)
    const sorted = [...members].sort((a, b) => {
      const r = richness(b) - richness(a)
      if (r !== 0) return r
      return a.id - b.id
    })
    candidates.push({ value: g.value, pos: g.pos, members, target: sorted[0], sources: sorted.slice(1) })
  }

  return candidates
}

function parseWordIds(raw: string): { ids: number[]; isObjFormat: boolean; original: unknown[] } {
  const parsed = JSON.parse(raw) as unknown[]
  const isObjFormat = parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null
  const ids = isObjFormat
    ? (parsed as Array<{ id: number }>).map((p) => p.id)
    : (parsed as number[])
  return { ids, isObjFormat, original: parsed }
}

function cleanupBaseHomonyms(sourceId: number) {
  const rows = db.prepare(`SELECT id, wordIds FROM base_homonyms`).all() as { id: number; wordIds: string }[]
  for (const h of rows) {
    const { ids, isObjFormat, original } = parseWordIds(h.wordIds)
    if (!ids.includes(sourceId)) continue

    const filtered = isObjFormat
      ? (original as Array<{ id: number }>).filter((p) => p.id !== sourceId)
      : (original as number[]).filter((id) => id !== sourceId)

    if (filtered.length === 0) {
      db.prepare(`DELETE FROM base_homonyms WHERE id = ?`).run(h.id)
    } else {
      db.prepare(`UPDATE base_homonyms SET wordIds = ? WHERE id = ?`).run(JSON.stringify(filtered), h.id)
    }
  }
}

function mergeSourceIntoTarget(targetId: number, sourceId: number) {
  const tx = db.transaction(() => {
    // Значения переносятся под цель по отдельности, не схлопываются —
    // ключевое отличие от lib/dedup/mergeLexemes.ts. translations и
    // semantic_relations ссылаются на meaningId, который не меняется, так
    // что их не нужно перепривязывать вообще.
    db.prepare(`UPDATE meanings SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId)

    db.prepare(`UPDATE lexemes_morphemes SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId)
    db.prepare(`UPDATE inflection_anomalies SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId)

    // Перенос аллофонов; при конфликте unique(lexemeId,flavorId,type) (у
    // цели уже есть такой флавор) строка остаётся на source и уходит
    // каскадом при удалении лексемы ниже — тот же приём, что и в
    // mergeLexemes.ts для semantic_relations.
    db.prepare(`UPDATE OR IGNORE lexeme_allophones SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId)

    cleanupBaseHomonyms(sourceId)

    const actionId = randomUUID()
    db.prepare(`
      INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt)
      VALUES (?, 'Lexeme', ?, 'mergedFrom', NULL, ?, NULL, ?, CURRENT_TIMESTAMP)
    `).run(actionId, targetId, String(sourceId), AUTHOR)

    // prepositionLexemeId ссылки на source (если source сам оказался чьим-то
    // предлогом) обнулятся автоматически через onDelete SetNull.
    db.prepare(`DELETE FROM lexemes WHERE id = ?`).run(sourceId)
  })
  tx()
}

function main() {
  const candidates = findCandidates()
  console.log(`Duplicate (value,pos) groups with a preposition on at least one member: ${candidates.length}\n`)

  for (const c of candidates) {
    console.log(`=== "${c.value}" (${c.pos}) — ${c.members.length} lexemes ===`)
    for (const m of c.members) {
      const meaningsCount = (getMeaningsCount.get(m.id) as { c: number }).c
      const tag = m.id === c.target.id ? "[TARGET]" : "[source]"
      console.log(`  ${tag} id=${m.id} slug=${m.slug} meanings=${meaningsCount} richness=${richness(m)}`)
    }
  }

  if (!APPLY) {
    console.log(`\n${candidates.length} groups would be merged. Dry run only — re-run with --apply to actually merge.`)
    db.close()
    return
  }

  console.log("\n--- Applying merges ---")
  let merged = 0
  for (const c of candidates) {
    for (const source of c.sources) {
      mergeSourceIntoTarget(c.target.id, source.id)
      merged++
    }
  }
  console.log(`\nDone. Merged ${merged} source lexemes into ${candidates.length} targets.`)
  db.close()
}

main()
