import type Database from "better-sqlite3"
import { randomUUID } from "crypto"
import { isUpperLetter, firstLetter, lowercaseVariants, CAPITALIZATION_SKIPPED_LANGUAGES } from "@/lib/capitalization"

// Очередь разбора имён собственных (/admin/proper-nouns). Правило
// мейнтейнера: перевод пишется с заглавной, только если у лексемы стоит
// properNoun. Очередь - proper_noun_signals (scripts/db/compute-proper-noun-signals.ts):
// лексемы без флага, у которых есть перевод с заглавной. Решение по лексеме:
//   proper=true  - поставить флаг, переводы не трогать;
//   proper=false - опустить первую букву каждого варианта перевода
//                  (кроме языков из CAPITALIZATION_SKIPPED_LANGUAGES).
// В обоих случаях строка уходит из очереди.

export interface ProperNounQueueItem {
    lexemeId: number
    isv: string
    pos: string | null
    corpusFrequencyPerMln: number | null
    translations: { language: string; value: string }[] // только с заглавной, для показа
    refCapitalized: boolean
    corpusMidCap: number
    corpusMidTotal: number
    suggestedProper: boolean
}

const SUGGEST_CORPUS_MIN = 3
const SUGGEST_CORPUS_SHARE = 0.8
// Предложение "это имя" - по любому из двух сигналов; порядок очереди - предложенные первыми.
const SUGGESTED_SQL = `(s.refCapitalized = 1 OR (s.corpusMidTotal >= ${SUGGEST_CORPUS_MIN} AND s.corpusMidCap * 1.0 / s.corpusMidTotal >= ${SUGGEST_CORPUS_SHARE}))`

export function countProperNounQueue(db: Database.Database): { total: number; suggested: number } {
    return db.prepare(`
        SELECT COUNT(*) AS total, COALESCE(SUM(${SUGGESTED_SQL}), 0) AS suggested
        FROM proper_noun_signals s JOIN lexemes l ON l.id = s.lexemeId WHERE COALESCE(l.properNoun, 0) = 0
    `).get() as { total: number; suggested: number }
}

export function fetchProperNounQueue(db: Database.Database, params: { limit: number; offset: number }): ProperNounQueueItem[] {
    const rows = db.prepare(`
        SELECT l.id AS lexemeId, COALESCE(la.value, l.value) AS isv, l.pos AS pos, l.corpusFrequencyPerMln AS corpusFrequencyPerMln,
               s.refCapitalized AS refCapitalized, s.corpusMidCap AS corpusMidCap, s.corpusMidTotal AS corpusMidTotal,
               ${SUGGESTED_SQL} AS suggestedProper
        FROM proper_noun_signals s
        JOIN lexemes l ON l.id = s.lexemeId
        LEFT JOIN lexeme_allophones la ON la.lexemeId = l.id AND la.type = 'standard'
            AND la.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
        WHERE COALESCE(l.properNoun, 0) = 0
        ORDER BY suggestedProper DESC, COALESCE(l.corpusFrequencyPerMln, 0) DESC, l.value ASC
        LIMIT ? OFFSET ?
    `).all(params.limit, params.offset) as (Omit<ProperNounQueueItem, "translations" | "refCapitalized" | "suggestedProper"> & { refCapitalized: number; suggestedProper: number })[]

    const translationsOf = db.prepare(`
        SELECT t.language AS language, t.value AS value FROM translations t JOIN meanings m ON m.id = t.meaningId
        WHERE m.lexemeId = ? AND t.value IS NOT NULL ORDER BY t.language, t.id
    `)
    return rows.map((row) => ({
        ...row,
        refCapitalized: row.refCapitalized === 1,
        suggestedProper: row.suggestedProper === 1,
        translations: (translationsOf.all(row.lexemeId) as { language: string; value: string }[])
            .filter((t) => !CAPITALIZATION_SKIPPED_LANGUAGES.has(t.language) && isUpperLetter(firstLetter(t.value))),
    }))
}

export interface ProperNounDecision {
    lexemeId: number
    proper: boolean
}

// Одна транзакция на пачку решений; аудит - синхронными INSERT (внутри
// db.transaction нельзя await, тот же приём, что в deduplication/actions.ts).
// Переводы пишутся напрямую, не через upsertTranslation: смена регистра - не
// новое значение, ответы волонтёров по нему остаются в силе.
export function applyProperNounDecisions(
    db: Database.Database,
    decisions: ProperNounDecision[],
    user: { id?: string; email?: string | null }
): { flagged: number; lowercased: number } {
    const userEmail = user.email || "unknown"
    const userId = user.id ?? null
    const audit = db.prepare(`
        INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail)
        VALUES (?, 'Lexeme', ?, ?, ?, ?, ?, ?)
    `)
    const flag = db.prepare(`UPDATE lexemes SET properNoun = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(properNoun, 0) = 0`)
    const translationsOf = db.prepare(`
        SELECT t.id AS id, t.language AS language, t.value AS value FROM translations t JOIN meanings m ON m.id = t.meaningId
        WHERE m.lexemeId = ? AND t.value IS NOT NULL
    `)
    const updateTranslation = db.prepare(`UPDATE translations SET value = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND value = ?`)
    const dequeue = db.prepare(`DELETE FROM proper_noun_signals WHERE lexemeId = ?`)

    const run = db.transaction(() => {
        let flagged = 0
        let lowercased = 0
        for (const decision of decisions) {
            const actionId = randomUUID()
            if (decision.proper) {
                if (flag.run(decision.lexemeId).changes > 0) {
                    audit.run(actionId, decision.lexemeId, "properNoun", "false", "true", userId, userEmail)
                    flagged++
                }
            } else {
                for (const t of translationsOf.all(decision.lexemeId) as { id: number; language: string; value: string }[]) {
                    if (CAPITALIZATION_SKIPPED_LANGUAGES.has(t.language)) continue
                    const fixed = lowercaseVariants(t.value)
                    if (fixed === t.value) continue
                    if (updateTranslation.run(fixed, t.id, t.value).changes === 0) continue
                    audit.run(actionId, decision.lexemeId, `${t.language}.value`, t.value, fixed, userId, userEmail)
                    lowercased++
                }
            }
            dequeue.run(decision.lexemeId)
        }
        return { flagged, lowercased }
    })
    return run()
}
