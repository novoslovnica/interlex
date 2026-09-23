import type Database from "better-sqlite3"
import { prismaAuth } from "@/lib/prisma"
import { RateLimiter } from "@/lib/rateLimit"

// Лимиты публичных карточек - по userId, а не по IP: proxy.ts работает на
// Edge без доступа к БД и знает только IP, а общий бакет публичной записи
// там (5/мин на всё сразу) для перелистывания карточек слишком тесен.
// In-memory, на один процесс - то же ограничение, что у lib/rateLimit.ts.
const VOTES_PER_MINUTE = 30
export const VOTES_PER_DAY = 500

const voteRateLimiter = new RateLimiter({ windowMs: 60_000, maxRequests: VOTES_PER_MINUTE })

export function checkVoteRateLimit(userId: string) {
    return voteRateLimiter.check(userId)
}

// Суточный потолок считается по таблице голосов, а не в памяти: переживает
// перезапуск процесса. Индекс (userId, createdAt) делает запрос дешёвым.
export function countVotesLastDay(db: Database.Database, userId: string): number {
    const row = db.prepare(`
        SELECT COUNT(*) AS c FROM translation_votes WHERE userId = ? AND createdAt >= datetime('now', '-1 day')
    `).get(userId) as { c: number }
    return row.c
}

// Языки, по которым пользователь вправе отвечать (UserLanguage в auth.db).
export async function getUserLanguageCodes(userId: string): Promise<string[]> {
    const rows = await prismaAuth.userLanguage.findMany({
        where: { userId },
        select: { language: true },
        orderBy: { createdAt: "asc" },
    })
    return rows.map((row) => row.language)
}
