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

// lexemes.value is a plain-ASCII-ish citation form (e.g. "posta") that can
// be missing diacritics the CORE allophone already carries (e.g. "pošta") -
// same gap fixed for the homepage word-of-day widget. Falls back to the raw
// value only for the (rare) lexeme with no CORE "standard" allophone row.
const CORE_VALUE_SQL = `COALESCE(
    (SELECT la.value FROM lexeme_allophones la
     JOIN allophone_flavors af ON af.id = la.flavorId
     WHERE la.lexemeId = l.id AND af.code = 'CORE' AND la.type = 'standard'
     LIMIT 1),
    l.value
)`;

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
            `SELECT l.id, l.slug, ${CORE_VALUE_SQL} as value, l.pos, l.cefrLevel FROM lexemes l WHERE l.id IN (${placeholders}) AND l.value IS NOT NULL`
        ).all(...dueWordIds) as LexemeRow[];
        for (const row of rows) {
            cards.push({ wordId: row.id, slug: row.slug, value: row.value, pos: row.pos, cefrLevel: row.cefrLevel, translation: null, isReview: true });
        }
    }

    const remaining = limit - cards.length;
    if (remaining > 0) {
        const excludeIds = [...new Set([...knownWordIds, ...dueWordIds])];
        const excludeClause = excludeIds.length > 0 ? `AND l.id NOT IN (${excludeIds.map(() => "?").join(",")})` : "";
        const cefrClause = cefrLevel ? "AND l.cefrLevel = ?" : "AND l.cefrLevel IS NOT NULL";
        const params: (string | number)[] = cefrLevel ? [cefrLevel, ...excludeIds] : [...excludeIds];

        const rows = db.prepare(`
            SELECT l.id, l.slug, ${CORE_VALUE_SQL} as value, l.pos, l.cefrLevel
            FROM lexemes l
            WHERE l.value IS NOT NULL AND (l.isCollocation IS NULL OR l.isCollocation != 1) ${cefrClause} ${excludeClause}
            ORDER BY l.corpusFrequencyPerMln DESC
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
