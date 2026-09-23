import type Database from "better-sqlite3"
import { upsertTranslation, type FieldChange } from "@/lib/translations"
import { settleVotes } from "./stats"

// Очередь модератора: переводы, по которым волонтёры сошлись на "неверно"
// (rejected) или не сошлись вовсе (disputed). Согласие "верно" сюда не
// попадает - оно ставит отметку само.

export interface ReviewVote {
    userId: string
    verdict: string
    suggestedValue: string | null
    comment: string | null
    weight: number
}

export interface ReviewItem {
    translationId: number
    language: string
    value: string
    communityStatus: string
    communityYes: number
    communityNo: number
    lexemeId: number
    isv: string | null
    pos: string | null
    meaningText: string | null
    context: { ru: string | null; en: string | null }
    votes: ReviewVote[]
    // Предложенные варианты, сгруппированные без учёта регистра, частые первыми.
    suggestions: { value: string; count: number }[]
}

const QUEUE_WHERE = `t.communityStatus IN ('rejected', 'disputed') AND t.verified IS NOT 1`

export function countReviewQueue(db: Database.Database, language?: string): number {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM translations t WHERE ${QUEUE_WHERE} ${language ? "AND t.language = ?" : ""}`)
        .get(...(language ? [language] : [])) as { c: number }
    return row.c
}

export function countReviewQueueByLanguage(db: Database.Database): Record<string, number> {
    const rows = db.prepare(`SELECT t.language AS language, COUNT(*) AS c FROM translations t WHERE ${QUEUE_WHERE} GROUP BY t.language`)
        .all() as { language: string; c: number }[]
    return Object.fromEntries(rows.map((row) => [row.language, row.c]))
}

export function fetchReviewQueue(
    db: Database.Database,
    params: { language?: string; limit: number; offset: number }
): ReviewItem[] {
    const rows = db.prepare(`
        SELECT t.id AS translationId, t.language AS language, t.value AS value, t.communityStatus AS communityStatus,
               t.communityYes AS communityYes, t.communityNo AS communityNo,
               m.id AS meaningId, m.meaning AS meaningText, l.id AS lexemeId, l.value AS lexemeValue, l.pos AS pos
        FROM translations t
        JOIN meanings m ON m.id = t.meaningId
        JOIN lexemes l ON l.id = m.lexemeId
        WHERE ${QUEUE_WHERE} ${params.language ? "AND t.language = ?" : ""}
        ORDER BY t.communityResolvedAt ASC, t.id ASC
        LIMIT ? OFFSET ?
    `).all(...(params.language ? [params.language] : []), params.limit, params.offset) as (Omit<ReviewItem, "isv" | "context" | "votes" | "suggestions"> & {
        meaningId: number; lexemeValue: string | null
    })[]

    const contextValue = db.prepare(`
        SELECT value FROM translations
        WHERE meaningId = ? AND language = ? AND value IS NOT NULL AND TRIM(value) != ''
        ORDER BY (verified IS 1) DESC, id ASC LIMIT 1
    `)
    const coreValue = db.prepare(`
        SELECT la.value AS value FROM lexeme_allophones la
        JOIN allophone_flavors af ON af.id = la.flavorId
        WHERE la.lexemeId = ? AND af.code = 'CORE' AND la.type = 'standard' LIMIT 1
    `)
    const votesOf = db.prepare(`
        SELECT userId, verdict, suggestedValue, comment, weight FROM translation_votes
        WHERE translationId = ? AND stale = 0 AND isControl = 0 ORDER BY id ASC
    `)

    return rows.map(({ meaningId, lexemeValue, ...row }) => {
        const votes = votesOf.all(row.translationId) as ReviewVote[]
        const grouped = new Map<string, { value: string; count: number }>()
        for (const vote of votes) {
            if (!vote.suggestedValue) continue
            const key = vote.suggestedValue.toLowerCase()
            const entry = grouped.get(key)
            if (entry) entry.count += 1
            else grouped.set(key, { value: vote.suggestedValue, count: 1 })
        }
        const lookup = (language: string) =>
            row.language === language ? null : ((contextValue.get(meaningId, language) as { value: string } | undefined)?.value ?? null)
        return {
            ...row,
            isv: (coreValue.get(row.lexemeId) as { value: string | null } | undefined)?.value ?? lexemeValue,
            context: { ru: lookup("ru"), en: lookup("en") },
            votes,
            suggestions: [...grouped.values()].sort((a, b) => b.count - a.count),
        }
    })
}

// keep    - перевод верен как есть: verified=1 (волонтёры, ответившие "верно", правы);
// replace - перевод неверен, вот правильный: новое значение + verified=1;
// clear   - перевод неверен, замены нет: значение очищается. Строка не
//           удаляется - удаление каскадом унесло бы ответы, а по ним считается
//           точность участников; прежнее значение остаётся в audit_logs.
export type ReviewAction = { kind: "keep" } | { kind: "replace"; value: string } | { kind: "clear" }

export type ReviewResult =
    | { ok: true; lexemeId: number; changes: FieldChange[] }
    | { ok: false; error: "not_found" | "not_in_queue" | "empty_value" }

export function resolveReview(db: Database.Database, translationId: number, action: ReviewAction): ReviewResult {
    const run = db.transaction((): ReviewResult => {
        const translation = db.prepare(`
            SELECT t.language AS language, t.value AS value, t.verified AS verified, t.communityStatus AS communityStatus, m.lexemeId AS lexemeId
            FROM translations t JOIN meanings m ON m.id = t.meaningId WHERE t.id = ?
        `).get(translationId) as {
            language: string; value: string | null; verified: number | null; communityStatus: string | null; lexemeId: number
        } | undefined
        if (!translation) return { ok: false, error: "not_found" }
        // Двое модераторов открыли одну очередь - второй не должен перезаписать решение первого.
        if (translation.verified === 1 || (translation.communityStatus !== "rejected" && translation.communityStatus !== "disputed")) {
            return { ok: false, error: "not_in_queue" }
        }

        const replacement = action.kind === "replace" ? action.value.trim() : ""
        if (action.kind === "replace" && replacement === "") return { ok: false, error: "empty_value" }
        const sameValue = action.kind === "replace" && replacement === (translation.value ?? "")

        if (action.kind === "keep" || sameValue) {
            // settleVotes("yes") выполнит сам upsertTranslation - verified стал 1 при том же значении.
            const { changes } = upsertTranslation(db, { id: translationId, language: translation.language, verified: 1 })
            return { ok: true, lexemeId: translation.lexemeId, changes }
        }

        // Итог "неверно" - ДО правки: смена значения пометит ответы stale, и судить будет некого.
        settleVotes(db, translationId, "no")
        const { changes } = action.kind === "replace"
            ? upsertTranslation(db, { id: translationId, language: translation.language, value: replacement, verified: 1, message: null })
            : upsertTranslation(db, { id: translationId, language: translation.language, value: null, verified: 0 })
        return { ok: true, lexemeId: translation.lexemeId, changes }
    })
    return run()
}
