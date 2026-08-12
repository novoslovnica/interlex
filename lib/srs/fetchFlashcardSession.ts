import { init } from "@/lib/sqlite";
import { prismaAuth } from "@/lib/prisma";
import { fetchTranslationsForLexemeIds } from "@/lib/translations";

export interface FlashcardSessionCard {
    wordId: number;
    slug: string;
    value: string;
    pos: string | null;
    cefrLevel: string | null;
    translation: string | null;
    isReview: boolean;
}

const DEFAULT_SESSION_SIZE = 15;

interface LexemeRow {
    id: number;
    slug: string;
    value: string;
    pos: string | null;
    cefrLevel: string | null;
}

/**
 * Builds one study session for a user: due-review cards first (from
 * FlashcardProgress in auth.db), then fills any remaining slots with new
 * cards from interlex.db at the requested CEFR level that the user hasn't
 * started yet. auth.db and interlex.db are never joined in one query (see
 * the project-wide "never cross database boundaries" rule) - progress state
 * and lexeme data are fetched separately and merged here.
 */
export async function fetchFlashcardSession(
    userId: string,
    cefrLevel: string | null,
    language: string,
    limit: number = DEFAULT_SESSION_SIZE
): Promise<FlashcardSessionCard[]> {
    const now = new Date();

    const dueProgress = await prismaAuth.flashcardProgress.findMany({
        where: { userId, nextReviewAt: { lte: now } },
        orderBy: { nextReviewAt: "asc" },
        take: limit,
        select: { wordId: true },
    });
    const dueWordIds = dueProgress.map((p) => p.wordId);

    const allProgress = await prismaAuth.flashcardProgress.findMany({
        where: { userId },
        select: { wordId: true },
    });
    const knownWordIds = allProgress.map((p) => p.wordId);

    const db = await init();
    const cards: FlashcardSessionCard[] = [];

    if (dueWordIds.length > 0) {
        const placeholders = dueWordIds.map(() => "?").join(",");
        const rows = db.prepare(
            `SELECT id, slug, value, pos, cefrLevel FROM lexemes WHERE id IN (${placeholders}) AND value IS NOT NULL`
        ).all(...dueWordIds) as LexemeRow[];
        for (const row of rows) {
            cards.push({ wordId: row.id, slug: row.slug, value: row.value, pos: row.pos, cefrLevel: row.cefrLevel, translation: null, isReview: true });
        }
    }

    const remaining = limit - cards.length;
    if (remaining > 0) {
        const excludeIds = [...new Set([...knownWordIds, ...dueWordIds])];
        const excludeClause = excludeIds.length > 0 ? `AND id NOT IN (${excludeIds.map(() => "?").join(",")})` : "";
        const cefrClause = cefrLevel ? "AND cefrLevel = ?" : "AND cefrLevel IS NOT NULL";
        const params: (string | number)[] = cefrLevel ? [cefrLevel, ...excludeIds] : [...excludeIds];

        const rows = db.prepare(`
            SELECT id, slug, value, pos, cefrLevel
            FROM lexemes
            WHERE value IS NOT NULL AND (isCollocation IS NULL OR isCollocation != 1) ${cefrClause} ${excludeClause}
            ORDER BY corpusFrequencyPerMln DESC
            LIMIT ?
        `).all(...params, remaining) as LexemeRow[];
        for (const row of rows) {
            cards.push({ wordId: row.id, slug: row.slug, value: row.value, pos: row.pos, cefrLevel: row.cefrLevel, translation: null, isReview: false });
        }
    }

    if (cards.length > 0) {
        const translationRows = fetchTranslationsForLexemeIds(db, cards.map((c) => c.wordId), language);
        const translationByLexeme = new Map<number, string>();
        for (const t of translationRows) {
            if (!t.value) continue;
            // Prefer a verified translation if one exists for this lexeme;
            // otherwise keep the first unverified one already stored.
            if (!translationByLexeme.has(t.lexemeId) || t.verified) {
                translationByLexeme.set(t.lexemeId, t.value);
            }
        }
        for (const card of cards) {
            card.translation = translationByLexeme.get(card.wordId) ?? null;
        }
    }

    return cards;
}
