import type Database from "better-sqlite3"

// Публичная статистика вклада (фаза 3): профиль участника, рейтинг, дашборд
// полноты, кандидаты в модераторы. Только чтение interlex.db; имена
// участников сюда не попадают - вызывающий берёт их через identity.ts.

export interface LanguageContribution {
    language: string
    votesTotal: number
    votesResolved: number
    votesAgreed: number
    accuracy: number | null
}

export interface ContributorSummary {
    votesTotal: number
    votesResolved: number
    votesAgreed: number
    accuracy: number | null
    confirmedTranslations: number // переводы, получившие "проверено сообществом" с участием этого голоса
    firstVoteAt: string | null
    lastVoteAt: string | null
    streakDays: number
    weekly: { week: string; votes: number }[] // последние 12 недель, старые первыми
    languages: LanguageContribution[]
}

// Серия: подряд идущие дни с хотя бы одним ответом, считая от сегодня (или от
// вчера - день ещё не кончился). Даты в UTC, как и createdAt.
export function computeStreak(days: string[], today: string): number {
    const set = new Set(days)
    const cursor = new Date(`${today}T00:00:00Z`)
    if (!set.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1)
    let streak = 0
    while (set.has(cursor.toISOString().slice(0, 10))) {
        streak++
        cursor.setUTCDate(cursor.getUTCDate() - 1)
    }
    return streak
}

export function fetchContributorSummary(db: Database.Database, userId: string, today = new Date().toISOString().slice(0, 10)): ContributorSummary | null {
    const languages = db.prepare(`
        SELECT language, votesTotal, votesResolved, votesAgreed, accuracy FROM contributor_stats
        WHERE userId = ? AND votesTotal > 0 ORDER BY votesTotal DESC
    `).all(userId) as LanguageContribution[]
    const totals = db.prepare(`
        SELECT COUNT(*) AS votesTotal, COUNT(agreed) AS votesResolved, COALESCE(SUM(agreed), 0) AS votesAgreed,
               MIN(createdAt) AS firstVoteAt, MAX(createdAt) AS lastVoteAt
        FROM translation_votes WHERE userId = ? AND isControl = 0
    `).get(userId) as { votesTotal: number; votesResolved: number; votesAgreed: number; firstVoteAt: string | null; lastVoteAt: string | null }
    if (totals.votesTotal === 0) return null

    const confirmed = db.prepare(`
        SELECT COUNT(*) AS c FROM translation_votes v JOIN translations t ON t.id = v.translationId
        WHERE v.userId = ? AND v.isControl = 0 AND v.stale = 0 AND v.verdict = 'yes' AND t.communityStatus = 'confirmed'
    `).get(userId) as { c: number }
    const days = (db.prepare(`
        SELECT DISTINCT date(createdAt) AS day FROM translation_votes WHERE userId = ? AND createdAt >= date(?, '-400 days')
    `).all(userId, today) as { day: string }[]).map((row) => row.day)
    const weeklyRows = db.prepare(`
        SELECT strftime('%Y-%W', createdAt) AS week, COUNT(*) AS votes FROM translation_votes
        WHERE userId = ? AND isControl = 0 AND createdAt >= date(?, '-84 days') GROUP BY week ORDER BY week
    `).all(userId, today) as { week: string; votes: number }[]

    return {
        ...totals,
        accuracy: totals.votesResolved > 0 ? totals.votesAgreed / totals.votesResolved : null,
        confirmedTranslations: confirmed.c,
        streakDays: computeStreak(days, today),
        weekly: weeklyRows,
        languages,
    }
}

export interface LeaderboardRow {
    userId: string
    votes: number
    agreed: number
}

// Участники с обнулённым весом (провалили контрольные) в рейтинг не попадают.
export function fetchLeaderboard(db: Database.Database, params: { language?: string; sinceDays?: number; limit?: number }): LeaderboardRow[] {
    const conditions = ["v.isControl = 0"]
    const values: (string | number)[] = []
    if (params.language) { conditions.push("v.language = ?"); values.push(params.language) }
    if (params.sinceDays) { conditions.push("v.createdAt >= datetime('now', ?)"); values.push(`-${params.sinceDays} days`) }
    return db.prepare(`
        SELECT v.userId AS userId, COUNT(*) AS votes, COALESCE(SUM(v.agreed), 0) AS agreed
        FROM translation_votes v
        WHERE ${conditions.join(" AND ")}
          AND NOT EXISTS (SELECT 1 FROM contributor_stats s WHERE s.userId = v.userId AND s.language = v.language AND s.flagged = 1)
        GROUP BY v.userId ORDER BY votes DESC, agreed DESC LIMIT ?
    `).all(...values, params.limit ?? 50) as LeaderboardRow[]
}

export interface LanguageCompleteness {
    language: string
    total: number       // непустых переводов
    moderator: number   // verified = 1
    community: number   // проверено сообществом (и не модератором)
    inProgress: number  // есть голоса, согласия ещё нет
    queued: number      // отклонено/спорно, ждёт модератора
    unchecked: number   // остальное
}

export function fetchCompleteness(db: Database.Database): LanguageCompleteness[] {
    return db.prepare(`
        SELECT language,
               COUNT(*) AS total,
               SUM(verified = 1) AS moderator,
               SUM(verified IS NOT 1 AND communityStatus = 'confirmed') AS community,
               SUM(verified IS NOT 1 AND communityStatus IS NULL AND communityYes + communityNo > 0) AS inProgress,
               SUM(verified IS NOT 1 AND communityStatus IN ('rejected', 'disputed')) AS queued
        FROM translations WHERE value IS NOT NULL AND TRIM(value) != ''
        GROUP BY language ORDER BY total DESC
    `).all().map((row) => {
        const r = row as Omit<LanguageCompleteness, "unchecked">
        return { ...r, unchecked: r.total - r.moderator - r.community - r.inProgress - r.queued }
    })
}

export interface ModeratorCandidate {
    userId: string
    language: string
    votesResolved: number
    accuracy: number
    controlTotal: number
    controlCorrect: number
}

// Пороги предложения роли; решение всегда за админом, автоматики нет.
export const CANDIDATE_MIN_RESOLVED = 200
export const CANDIDATE_MIN_ACCURACY = 0.9
export const CANDIDATE_MIN_CONTROLS = 10

export function fetchModeratorCandidates(db: Database.Database): ModeratorCandidate[] {
    return db.prepare(`
        SELECT userId, language, votesResolved, accuracy, controlTotal, controlCorrect FROM contributor_stats
        WHERE flagged = 0 AND votesResolved >= ? AND accuracy >= ?
          AND controlTotal >= ? AND controlCorrect * 1.0 / controlTotal >= ?
        ORDER BY votesResolved DESC
    `).all(CANDIDATE_MIN_RESOLVED, CANDIDATE_MIN_ACCURACY, CANDIDATE_MIN_CONTROLS, CANDIDATE_MIN_ACCURACY) as ModeratorCandidate[]
}
