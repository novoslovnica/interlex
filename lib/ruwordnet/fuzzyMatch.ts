import Database from "better-sqlite3"
import fs from "fs"
import path from "path"
import { levenshtein } from "@/lib/levenshtein"

const PYTHON_DIR = path.resolve(process.cwd(), "scripts", "python")

// Python version in the venv directory name (python3.14, python3.11, ...)
// isn't pinned anywhere - resolve it by scanning lib/ rather than hardcoding.
function resolveRuWordNetDbPath(): string | null {
  const libDir = path.join(PYTHON_DIR, ".venv", "lib")
  if (!fs.existsSync(libDir)) return null
  for (const entry of fs.readdirSync(libDir)) {
    if (!entry.startsWith("python")) continue
    const candidate = path.join(libDir, entry, "site-packages", "ruwordnet", "static", "ruwordnet.db")
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

let cachedDb: Database.Database | null | undefined

function getRuWordNetDb(): Database.Database | null {
  if (cachedDb !== undefined) return cachedDb
  const dbPath = resolveRuWordNetDbPath()
  cachedDb = dbPath ? new Database(dbPath, { readonly: true, fileMustExist: true }) : null
  return cachedDb
}

/**
 * Suggests near-miss RuWordNet lemmas for a translation that failed exact
 * lookup (process_words.py's get_synonyms_and_antonyms only tries the word
 * itself and its ё/е variant - see AGENTS.md on the grammatical-form-mismatch
 * root cause of the ~48% unmatched gap, e.g. "вычитка текста" vs the stored
 * lemma "вычитка текст"). Reads directly from a read-only copy of
 * RuWordNet's own SQLite database bundled with the `ruwordnet` pip package
 * (scripts/python/.venv/.../ruwordnet/static/ruwordnet.db) - this is a
 * vendored reference dataset, not one of the project's 4 app databases, so
 * the "never cross database boundaries" rule doesn't apply here.
 *
 * Informational only, never auto-applied: a fuzzy match is a plausible
 * typo/inflection-form correction, not a confirmed identity - same
 * "never fabricate a linguistic fact" principle as VerbGovernment/
 * CorpusCandidateProposal staying moderator-reviewed rather than
 * auto-written (see AGENTS.md).
 */
export function findFuzzyLemmaCandidates(word: string, limit = 5, maxDistance = 2): string[] {
  const db = getRuWordNetDb()
  if (!db) return []

  const query = word.trim().toUpperCase()
  if (!query) return []

  const minLen = Math.max(1, query.length - maxDistance)
  const maxLen = query.length + maxDistance
  const rows = db
    .prepare(`SELECT DISTINCT lemma FROM sense WHERE lemma IS NOT NULL AND length(lemma) BETWEEN ? AND ?`)
    .all(minLen, maxLen) as { lemma: string }[]

  const scored: { lemma: string; distance: number }[] = []
  for (const row of rows) {
    if (!row.lemma) continue
    const distance = levenshtein(query, row.lemma)
    if (distance > 0 && distance <= maxDistance) {
      scored.push({ lemma: row.lemma, distance })
    }
  }
  scored.sort((a, b) => a.distance - b.distance || a.lemma.localeCompare(b.lemma))

  const seen = new Set<string>()
  const result: string[] = []
  for (const s of scored) {
    const normalized = s.lemma.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
    if (result.length >= limit) break
  }
  return result
}
