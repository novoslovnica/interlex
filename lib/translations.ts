import type Database from "better-sqlite3"
import { randomUUID as _randomUUID } from "crypto"

/**
 * Operates on the consolidated `translations` table (2026-07-23), which
 * replaces the 18 old per-language tables (en, ru, mk, sr, uk, bg, pl, be,
 * cs, sk, sl, hr, cu, de, nl, eo, hsb, dsb — not yet dropped, see AGENTS.md).
 *
 * `meaningId` is the only live FK — "all translations for lexeme X" is
 * derived via a join through `meanings.lexemeId`, never via a stored
 * lexeme-id column. The old tables' `wordId` column was supposed to point at
 * Meaning but in practice held the owning Lexeme's id, and was already wrong
 * for 93% of hsb/dsb rows (and hundreds of en/ru/mk/sr/bg rows) on the live
 * DB — its historical value is preserved read-only as `legacyWordId` on the
 * new table, but no function here reads or writes it.
 */

export const TRANSLATION_LANGUAGE_CODES = [
  "en", "ru", "mk", "sr", "uk", "bg", "pl", "be", "cs", "sk",
  "sl", "hr", "cu", "de", "nl", "eo", "hsb", "dsb",
] as const

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGE_CODES)[number]

export interface TranslationRow {
  id: number
  language: string
  value: string | null
  verified: number | null
  message: string | null
  meaningId: number | null
  legacyWordId: number | null
}

export interface FieldChange {
  field: string
  oldValue: unknown
  newValue: unknown
}

/** All translations belonging to any meaning of lexeme `lexemeId`, grouped by language. */
export function fetchTranslationsForLexeme(db: Database.Database, lexemeId: number): Record<string, TranslationRow[]> {
  const rows = db.prepare(`
    SELECT t.* FROM translations t
    JOIN meanings m ON m.id = t.meaningId
    WHERE m.lexemeId = ?
  `).all(lexemeId) as TranslationRow[]

  const grouped: Record<string, TranslationRow[]> = {}
  for (const row of rows) {
    if (!grouped[row.language]) grouped[row.language] = []
    grouped[row.language].push(row)
  }
  return grouped
}

/**
 * All translations for a set of meaningIds, grouped by language then by
 * meaningId (mirrors the old per-language `getLangDataAll` loop's shape, so
 * callers like `[lang][meaningId]` don't need to change).
 */
export function fetchTranslationsForMeaningIds(
  db: Database.Database,
  meaningIds: number[],
  languages?: string[]
): Record<string, Record<number, TranslationRow[]>> {
  const result: Record<string, Record<number, TranslationRow[]>> = {}
  if (meaningIds.length === 0) return result

  const placeholders = meaningIds.map(() => "?").join(",")
  const langClause = languages && languages.length > 0
    ? ` AND language IN (${languages.map(() => "?").join(",")})`
    : ""
  const rows = db.prepare(`
    SELECT * FROM translations WHERE meaningId IN (${placeholders})${langClause}
  `).all(...meaningIds, ...(languages ?? [])) as TranslationRow[]

  for (const row of rows) {
    if (row.meaningId == null) continue
    if (!result[row.language]) result[row.language] = {}
    if (!result[row.language][row.meaningId]) result[row.language][row.meaningId] = []
    result[row.language][row.meaningId].push(row)
  }
  return result
}

/** All translation rows for one (meaningId, language) pair — old tables allow more than one. */
export function fetchTranslationsForMeaning(db: Database.Database, meaningId: number, language: string): TranslationRow[] {
  return db.prepare(`SELECT * FROM translations WHERE meaningId = ? AND language = ?`).all(meaningId, language) as TranslationRow[]
}

/**
 * Flat list of `language` translation rows belonging to any meaning of the
 * given lexemes, each annotated with the owning `lexemeId` (derived via the
 * meaningId -> Meaning.lexemeId join). Used by the translator (`/translate`)
 * to go from a set of matched ISV lexemes to their translations in one
 * target language.
 */
export function fetchTranslationsForLexemeIds(
  db: Database.Database,
  lexemeIds: number[],
  language: string
): (TranslationRow & { lexemeId: number })[] {
  if (lexemeIds.length === 0) return []
  const placeholders = lexemeIds.map(() => "?").join(",")
  return db.prepare(`
    SELECT t.*, m.lexemeId AS lexemeId FROM translations t
    JOIN meanings m ON m.id = t.meaningId
    WHERE m.lexemeId IN (${placeholders}) AND t.language = ?
  `).all(...lexemeIds, language) as (TranslationRow & { lexemeId: number })[]
}

/** A single translation row, by id (scoped to language as a sanity check) or by (meaningId, language). */
export function fetchOneTranslation(
  db: Database.Database,
  params: { translationId?: number; meaningId?: number; language: string }
): TranslationRow | undefined {
  if (params.translationId) {
    return db.prepare(`SELECT * FROM translations WHERE id = ? AND language = ?`)
      .get(params.translationId, params.language) as TranslationRow | undefined
  }
  if (params.meaningId != null) {
    return db.prepare(`SELECT * FROM translations WHERE meaningId = ? AND language = ? ORDER BY id ASC LIMIT 1`)
      .get(params.meaningId, params.language) as TranslationRow | undefined
  }
  return undefined
}

/**
 * Create-if-missing-else-update. Returns the resulting row plus `FieldChange[]`
 * shaped exactly as `${language}.value` / `${language}.verified` /
 * `${language}.message` / `${language}.created`, matching the audit-log
 * field-name convention every existing call site already relies on.
 */
export function upsertTranslation(
  db: Database.Database,
  params: {
    id?: number
    meaningId?: number
    language: string
    value?: string | null
    verified?: number
    message?: string | null
  }
): { row: TranslationRow; changes: FieldChange[]; created: boolean } {
  const existing = params.id
    ? (db.prepare(`SELECT * FROM translations WHERE id = ?`).get(params.id) as TranslationRow | undefined)
    : (params.meaningId != null
      ? (db.prepare(`SELECT * FROM translations WHERE meaningId = ? AND language = ? ORDER BY id ASC LIMIT 1`)
        .get(params.meaningId, params.language) as TranslationRow | undefined)
      : undefined)

  const changes: FieldChange[] = []

  if (!existing) {
    if (params.meaningId == null) {
      throw new Error("upsertTranslation: meaningId is required to create a new translation")
    }
    const info = db.prepare(`
      INSERT INTO translations (language, value, verified, message, meaningId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      params.language,
      params.value ?? null,
      params.verified ?? null,
      params.message ?? null,
      params.meaningId
    )
    if (params.value !== undefined) changes.push({ field: `${params.language}.value`, oldValue: null, newValue: params.value })
    if (params.verified !== undefined) changes.push({ field: `${params.language}.verified`, oldValue: null, newValue: params.verified })
    if (params.message !== undefined) changes.push({ field: `${params.language}.message`, oldValue: null, newValue: params.message })
    if (changes.length > 0) changes.push({ field: `${params.language}.created`, oldValue: null, newValue: "new translation" })

    const row = db.prepare(`SELECT * FROM translations WHERE id = ?`).get(info.lastInsertRowid) as TranslationRow
    return { row, changes, created: true }
  }

  const updateData: { value: string | null; verified: number | null; message: string | null } = {
    value: params.value !== undefined ? (params.value ?? null) : existing.value,
    verified: params.verified !== undefined ? params.verified : existing.verified,
    message: params.message !== undefined ? (params.message ?? null) : existing.message,
  }

  if (params.verified !== undefined && (existing.verified ?? 0) !== params.verified) {
    changes.push({ field: `${params.language}.verified`, oldValue: existing.verified ?? 0, newValue: params.verified })
  }
  if (params.value !== undefined && (existing.value ?? "") !== (params.value ?? "")) {
    changes.push({ field: `${params.language}.value`, oldValue: existing.value ?? null, newValue: params.value })
  }
  if (params.message !== undefined && (existing.message ?? "") !== (params.message ?? "")) {
    changes.push({ field: `${params.language}.message`, oldValue: existing.message ?? null, newValue: params.message })
  }

  db.prepare(`
    UPDATE translations SET value = ?, verified = ?, message = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?
  `).run(updateData.value, updateData.verified, updateData.message, existing.id)

  const row = db.prepare(`SELECT * FROM translations WHERE id = ?`).get(existing.id) as TranslationRow
  return { row, changes, created: false }
}

/**
 * Replaces meaningId's set of translation rows for `language` with exactly
 * `translations` — deletes rows whose id disappeared from the submitted set,
 * then upserts the rest. Returns the combined FieldChange[] across all rows.
 */
export function syncTranslationsForMeaning(
  db: Database.Database,
  params: {
    meaningId: number
    language: string
    translations: { id: number; value: string; verified: number; message: string }[]
  }
): FieldChange[] {
  const existingRows = db.prepare(`SELECT id FROM translations WHERE meaningId = ? AND language = ?`)
    .all(params.meaningId, params.language) as { id: number }[]
  const existingIds = new Set(existingRows.map((r) => r.id))
  const formIds = new Set(params.translations.filter((t) => t.id > 0).map((t) => t.id))

  const toDelete = [...existingIds].filter((id) => !formIds.has(id))
  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => "?").join(",")
    db.prepare(`DELETE FROM translations WHERE id IN (${placeholders})`).run(...toDelete)
  }

  const allChanges: FieldChange[] = []
  for (const t of params.translations) {
    if (t.id > 0) {
      if (!t.value.trim() && !existingIds.has(t.id)) continue
      const { changes } = upsertTranslation(db, {
        id: t.id,
        language: params.language,
        value: t.value,
        verified: t.verified,
        message: t.message,
      })
      allChanges.push(...changes)
    } else if (t.value.trim()) {
      const { changes } = upsertTranslation(db, {
        meaningId: params.meaningId,
        language: params.language,
        value: t.value,
        verified: t.verified,
        message: t.message,
      })
      allChanges.push(...changes)
    }
  }
  return allChanges
}

/**
 * Rewires every translation row belonging to any of `fromMeaningIds` onto
 * `toMeaningId` — replaces the 18-language `UPDATE "${lang}" SET meaningId=?`
 * loop in lib/dedup/mergeLexemes.ts. Must NOT open its own transaction; the
 * caller already wraps this in one (better-sqlite3 can't await inside
 * db.transaction, so this stays a plain synchronous statement).
 */
export function rewireMeaningId(db: Database.Database, params: { fromMeaningIds: number[]; toMeaningId: number }): void {
  if (params.fromMeaningIds.length === 0) return
  const placeholders = params.fromMeaningIds.map(() => "?").join(",")
  db.prepare(`UPDATE translations SET meaningId = ? WHERE meaningId IN (${placeholders})`)
    .run(params.toMeaningId, ...params.fromMeaningIds)
}
