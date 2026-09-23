import type Database from "better-sqlite3"
import { computeReputation } from "./reputation"

// Судейство ответов и статистика участника. Источник истины - колонка
// translation_votes.agreed; contributor_stats - только её агрегат, который
// всегда можно пересобрать (scripts/db/recompute-contributor-stats.ts).
// Всё синхронно и без собственных транзакций: вызывается изнутри транзакций
// castVote / upsertTranslation / действий модератора.

export type Outcome = "yes" | "no"

// Проставляет действующим ответам по переводу, совпали ли они с итогом.
// Повторный вызов с другим итогом перезаписывает - так решение модератора
// отменяет предварительный итог согласия волонтёров.
// ВАЖНО: вызывать ДО того, как смена значения пометит ответы stale
// (resetCommunityReview) - устаревшие ответы здесь намеренно не трогаются.
export function settleVotes(db: Database.Database, translationId: number, outcome: Outcome): void {
    const voters = db.prepare(`
        SELECT DISTINCT userId, language FROM translation_votes
        WHERE translationId = ? AND stale = 0 AND isControl = 0 AND verdict IN ('yes', 'no')
    `).all(translationId) as { userId: string; language: string }[]
    if (voters.length === 0) return

    db.prepare(`
        UPDATE translation_votes SET agreed = (verdict = ?)
        WHERE translationId = ? AND stale = 0 AND isControl = 0 AND verdict IN ('yes', 'no')
    `).run(outcome, translationId)

    for (const voter of voters) refreshContributorStats(db, voter.userId, voter.language)
}

export function refreshContributorStats(db: Database.Database, userId: string, language: string): void {
    const totals = db.prepare(`
        SELECT COUNT(CASE WHEN isControl = 0 THEN 1 END) AS votesTotal,
               COUNT(CASE WHEN isControl = 0 AND agreed IS NOT NULL THEN 1 END) AS votesResolved,
               COALESCE(SUM(CASE WHEN isControl = 0 THEN agreed END), 0) AS votesAgreed,
               COUNT(CASE WHEN isControl = 1 AND agreed IS NOT NULL THEN 1 END) AS controlTotal,
               COALESCE(SUM(CASE WHEN isControl = 1 THEN agreed END), 0) AS controlCorrect
        FROM translation_votes WHERE userId = ? AND language = ?
    `).get(userId, language) as {
        votesTotal: number; votesResolved: number; votesAgreed: number; controlTotal: number; controlCorrect: number
    }
    const reputation = computeReputation(totals)

    db.prepare(`
        INSERT INTO contributor_stats (userId, language, votesTotal, votesResolved, votesAgreed, controlTotal, controlCorrect, accuracy, weight, flagged, updatedAt)
        VALUES (@userId, @language, @votesTotal, @votesResolved, @votesAgreed, @controlTotal, @controlCorrect, @accuracy, @weight, @flagged, CURRENT_TIMESTAMP)
        ON CONFLICT (userId, language) DO UPDATE SET
            votesTotal = excluded.votesTotal, votesResolved = excluded.votesResolved, votesAgreed = excluded.votesAgreed,
            controlTotal = excluded.controlTotal, controlCorrect = excluded.controlCorrect,
            accuracy = excluded.accuracy, weight = excluded.weight, flagged = excluded.flagged, updatedAt = CURRENT_TIMESTAMP
    `).run({ userId, language, ...totals, accuracy: reputation.accuracy, weight: reputation.weight, flagged: reputation.flagged ? 1 : 0 })
}

// Вес, с которым записывается новый голос. Нет строки - участник новый, вес 1.
export function getContributorWeight(db: Database.Database, userId: string, language: string): number {
    const row = db.prepare(`SELECT weight FROM contributor_stats WHERE userId = ? AND language = ?`)
        .get(userId, language) as { weight: number } | undefined
    return row?.weight ?? 1
}

export function getControlAnswerCount(db: Database.Database, userId: string, language: string): number {
    const row = db.prepare(`SELECT controlTotal FROM contributor_stats WHERE userId = ? AND language = ?`)
        .get(userId, language) as { controlTotal: number } | undefined
    return row?.controlTotal ?? 0
}
