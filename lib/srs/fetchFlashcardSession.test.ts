import { describe, it, expect, vi, beforeEach } from "vitest";

const flashcardProgressFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    prismaAuth: {
        flashcardProgress: { findMany: (...args: unknown[]) => flashcardProgressFindMany(...args) },
    },
}));

// A tiny fake better-sqlite3-like db: prepare(sql) returns an object whose
// .all(...params) is resolved by matching the SQL text against a queue of
// canned responses registered via `queueAll`.
const allQueue: { match: (sql: string) => boolean; rows: unknown[] }[] = [];
function queueAll(match: (sql: string) => boolean, rows: unknown[]) {
    allQueue.push({ match, rows });
}
const fakeDb = {
    prepare: (sql: string) => ({
        all: (..._params: unknown[]) => {
            const entry = allQueue.find((e) => e.match(sql));
            return entry ? entry.rows : [];
        },
    }),
};
vi.mock("@/lib/sqlite", () => ({
    init: async () => fakeDb,
}));

const fetchTranslationsForLexemeIds = vi.fn();
vi.mock("@/lib/translations", () => ({
    fetchTranslationsForLexemeIds: (...args: unknown[]) => fetchTranslationsForLexemeIds(...args),
}));

import { fetchFlashcardSession } from "./fetchFlashcardSession";

describe("fetchFlashcardSession", () => {
    beforeEach(() => {
        flashcardProgressFindMany.mockReset();
        fetchTranslationsForLexemeIds.mockReset();
        allQueue.length = 0;
    });

    it("puts due-review cards first, then fills remaining slots with new cards, and attaches translations", async () => {
        flashcardProgressFindMany
            .mockResolvedValueOnce([{ wordId: 101 }]) // due
            .mockResolvedValueOnce([{ wordId: 101 }]); // all progress (same word, already started)

        queueAll((sql) => sql.includes("id IN"), [
            { id: 101, slug: "byti-VERB", value: "byti", pos: "VERB", cefrLevel: "A1" },
        ]);
        queueAll((sql) => sql.includes("corpusFrequencyPerMln"), [
            { id: 202, slug: "voda-NOUN", value: "voda", pos: "NOUN", cefrLevel: "A1" },
        ]);

        fetchTranslationsForLexemeIds.mockReturnValue([
            { lexemeId: 101, value: "to be", verified: 1, language: "en" },
            { lexemeId: 202, value: "water", verified: 0, language: "en" },
        ]);

        const cards = await fetchFlashcardSession("user-1", "A1", "en", 2);

        expect(cards).toHaveLength(2);
        expect(cards[0]).toMatchObject({ wordId: 101, value: "byti", isReview: true, translation: "to be" });
        expect(cards[1]).toMatchObject({ wordId: 202, value: "voda", isReview: false, translation: "water" });
    });

    it("returns only new cards when there is nothing due", async () => {
        flashcardProgressFindMany
            .mockResolvedValueOnce([]) // due
            .mockResolvedValueOnce([]); // all progress

        queueAll((sql) => sql.includes("corpusFrequencyPerMln"), [
            { id: 303, slug: "dom-NOUN", value: "dom", pos: "NOUN", cefrLevel: "A1" },
        ]);
        fetchTranslationsForLexemeIds.mockReturnValue([]);

        const cards = await fetchFlashcardSession("user-1", "A1", "en", 5);

        expect(cards).toHaveLength(1);
        expect(cards[0]).toMatchObject({ wordId: 303, isReview: false, translation: null });
    });

    it("prefers a verified translation over an earlier unverified one for the same lexeme", async () => {
        flashcardProgressFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
        queueAll((sql) => sql.includes("corpusFrequencyPerMln"), [
            { id: 404, slug: "test-NOUN", value: "test", pos: "NOUN", cefrLevel: "A1" },
        ]);
        fetchTranslationsForLexemeIds.mockReturnValue([
            { lexemeId: 404, value: "unverified guess", verified: 0, language: "en" },
            { lexemeId: 404, value: "verified translation", verified: 1, language: "en" },
        ]);

        const cards = await fetchFlashcardSession("user-1", "A1", "en", 1);

        expect(cards[0].translation).toBe("verified translation");
    });
});
