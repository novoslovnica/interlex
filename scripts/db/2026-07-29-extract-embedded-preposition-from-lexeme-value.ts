import path from "path"
import Database from "better-sqlite3"
import { randomUUID } from "crypto"

// Многие VERB/ADJ-лексемы исторически заведены с предлогом, вписанным прямо
// в value ("pristupati do", "pristupati k") вместо структурной связи —
// governsCase→ValencyFrame миграция (2026-07-26) перенесла только голый
// падеж, предлог никогда не извлекался (см. комментарий в
// scripts/db/2026-07-26-migrate-governs-case-to-valency.ts). Теперь, когда
// есть ValencyArgument.prepositionLexemeId (Фаза 1, 2026-07-29), этот скрипт
// извлекает предлог из value в структурную связь и убирает его из текста —
// первый шаг перед scripts/db/2026-07-29-merge-preposition-duplicate-lexemes.ts
// (тот сможет слить "pristupati do"/"pristupati k" только после того, как
// оба станут просто "pristupati").
//
// Обрабатывает автоматически ТОЛЬКО безопасный случай: ровно одно значение,
// ровно один ValencyFrame, ровно один ValencyArgument (типичный след
// governsCase-миграции — падеж уже есть, предлога нет). Остальное только
// перечисляется в отчёте, без изменений:
//   - лексемы без единого ValencyFrame — падеж пришлось бы придумывать,
//     а это ровно то, чего проект сознательно избегает (см. пустой
//     VERB_GOVERNMENT_FALLBACK в lib/corpus/syntax/government.ts, "ни один
//     факт... здесь не придумывается") — такие лексемы нужно сначала
//     разметить вручную через ArticleForm (теперь там есть выбор предлога).
//   - лексемы, чей value содержит запятую (несколько вариантов написания,
//     напр. "sȯocati se s, suocati se s") — неоднозначно, какой из
//     вариантов действительно оканчивается на извлекаемый предлог.
//
// slug НЕ переименовывается (сохраняет стабильность существующих ссылок
// /words/<slug>) — после слияния целевая лексема может визуально "не
// совпадать" по slug с новым value, это осознанный компромисс.
//
// По умолчанию — dry-run. Реальная запись — только с --apply.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-29-extract-embedded-preposition-from-lexeme-value.ts
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-29-extract-embedded-preposition-from-lexeme-value.ts --apply

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const APPLY = process.argv.includes("--apply")
const AUTHOR = "script:extract-embedded-preposition"
const TARGET_POS = ["VERB", "ADJ"]

console.log(`Target DB: ${DB_PATH}`)
console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (read-only)"}\n`)

const db = new Database(DB_PATH)
db.pragma("foreign_keys = ON")

interface AdpLexeme {
  id: number
  value: string
}

// Значения ADP-лексем сами иногда хранят несколько вариантов через запятую
// (напр. "o, ob", "#s, sȯ") — разбиваем на отдельные токены и мапим каждый
// на его собственную лексему-предлог. Многословные предлоги ("bez obzira
// na") здесь намеренно не участвуют — целевой случай ("глагол + один
// предлог") ищет ровно один хвостовой токен.
function buildPrepositionTokenMap(): Map<string, AdpLexeme> {
  const rows = db.prepare(`SELECT id, value FROM lexemes WHERE pos = 'ADP' AND value IS NOT NULL`).all() as AdpLexeme[]
  const map = new Map<string, AdpLexeme>()
  for (const r of rows) {
    for (const variant of r.value.split(",")) {
      const token = variant.trim().toLowerCase()
      if (token && !token.includes(" ") && !map.has(token)) {
        map.set(token, { id: r.id, value: variant.trim() })
      }
    }
  }
  return map
}

interface LexemeRow {
  id: number
  slug: string
  value: string
  pos: string
}

interface CleanCandidate {
  lexeme: LexemeRow
  newValue: string
  prep: AdpLexeme
  argumentId: number
  meaningId: number
}

interface FlaggedCandidate {
  lexeme: LexemeRow
  reason: "no_valency_frame" | "comma_in_value"
  matchedPrepToken: string
}

function findCandidates(prepTokens: Map<string, AdpLexeme>): { clean: CleanCandidate[]; flagged: FlaggedCandidate[] } {
  const placeholders = TARGET_POS.map(() => "?").join(",")
  const rows = db.prepare(`
    SELECT id, slug, value, pos FROM lexemes
    WHERE value LIKE '% %' AND pos IN (${placeholders})
  `).all(...TARGET_POS) as LexemeRow[]

  const clean: CleanCandidate[] = []
  const flagged: FlaggedCandidate[] = []

  for (const lex of rows) {
    const words = lex.value.trim().split(/\s+/)
    const lastToken = words[words.length - 1].toLowerCase()
    const prep = prepTokens.get(lastToken)
    if (!prep) continue

    if (lex.value.includes(",")) {
      flagged.push({ lexeme: lex, reason: "comma_in_value", matchedPrepToken: lastToken })
      continue
    }

    const meanings = db.prepare(`SELECT id FROM meanings WHERE lexemeId = ?`).all(lex.id) as { id: number }[]
    if (meanings.length !== 1) {
      flagged.push({ lexeme: lex, reason: "no_valency_frame", matchedPrepToken: lastToken })
      continue
    }
    const frames = db.prepare(`SELECT id FROM valency_frames WHERE meaningId = ?`).all(meanings[0].id) as { id: number }[]
    if (frames.length !== 1) {
      flagged.push({ lexeme: lex, reason: "no_valency_frame", matchedPrepToken: lastToken })
      continue
    }
    const args = db.prepare(`SELECT id FROM valency_arguments WHERE frameId = ?`).all(frames[0].id) as { id: number }[]
    if (args.length !== 1) {
      flagged.push({ lexeme: lex, reason: "no_valency_frame", matchedPrepToken: lastToken })
      continue
    }

    const newValue = words.slice(0, -1).join(" ").trim()
    clean.push({ lexeme: lex, newValue, prep, argumentId: args[0].id, meaningId: meanings[0].id })
  }

  return { clean, flagged }
}

function applyCandidate(c: CleanCandidate) {
  const tx = db.transaction(() => {
    const argBefore = db.prepare(`SELECT preposition, prepositionLexemeId FROM valency_arguments WHERE id = ?`).get(c.argumentId) as { preposition: string | null; prepositionLexemeId: number | null }

    db.prepare(`UPDATE lexemes SET value = ? WHERE id = ?`).run(c.newValue, c.lexeme.id)
    db.prepare(`UPDATE valency_arguments SET preposition = ?, prepositionLexemeId = ? WHERE id = ?`).run(c.prep.value, c.prep.id, c.argumentId)

    const actionId = randomUUID()
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)
    `)
    insertAudit.run(actionId, "Lexeme", c.lexeme.id, "value", c.lexeme.value, c.newValue, AUTHOR)
    insertAudit.run(actionId, "Lexeme", c.lexeme.id, `valencyArgument:${c.argumentId}.preposition`, argBefore.preposition, c.prep.value, AUTHOR)
    insertAudit.run(actionId, "Lexeme", c.lexeme.id, `valencyArgument:${c.argumentId}.prepositionLexemeId`, argBefore.prepositionLexemeId, String(c.prep.id), AUTHOR)
  })
  tx()
}

function main() {
  const prepTokens = buildPrepositionTokenMap()
  console.log(`Known single-word preposition tokens: ${prepTokens.size}\n`)

  const { clean, flagged } = findCandidates(prepTokens)

  console.log(`=== Auto-processable (1 meaning, 1 frame, 1 argument): ${clean.length} ===`)
  for (const c of clean) {
    console.log(`  id=${c.lexeme.id} slug=${c.lexeme.slug}  "${c.lexeme.value}" -> "${c.newValue}"  (+preposition "${c.prep.value}" -> lexeme ${c.prep.id})`)
  }

  const noFrame = flagged.filter((f) => f.reason === "no_valency_frame")
  const commaIssue = flagged.filter((f) => f.reason === "comma_in_value")

  console.log(`\n=== Needs manual valency entry first (no existing frame — case unknown, not guessing): ${noFrame.length} ===`)
  for (const f of noFrame) {
    console.log(`  id=${f.lexeme.id} slug=${f.lexeme.slug}  "${f.lexeme.value}"  (looks like it ends in preposition "${f.matchedPrepToken}")`)
  }

  console.log(`\n=== Needs manual review (comma-separated spelling variants in value): ${commaIssue.length} ===`)
  for (const f of commaIssue) {
    console.log(`  id=${f.lexeme.id} slug=${f.lexeme.slug}  "${f.lexeme.value}"`)
  }

  if (!APPLY) {
    console.log(`\n${clean.length} would be extracted, ${flagged.length} flagged for manual review. Dry run only — re-run with --apply to write.`)
    db.close()
    return
  }

  console.log("\n--- Applying extraction ---")
  for (const c of clean) {
    applyCandidate(c)
  }
  console.log(`\nDone. Extracted preposition from ${clean.length} lexemes. ${flagged.length} still need manual attention (see report above).`)
  db.close()
}

main()
