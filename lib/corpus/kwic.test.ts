import { describe, it, expect, vi, beforeEach } from "vitest";

const initCorpusDb = vi.fn();
vi.mock("./corpusSqlite", () => ({ initCorpusDb: (...args: unknown[]) => initCorpusDb(...args) }));

import { searchKwic, clampKwicLimit, clampKwicOffset, CqlQueryError, MAX_CQL_SEGMENTS, KWIC_MAX_LIMIT } from "./kwic";

function makeFakeDb(handlers: { match: (sql: string) => boolean; all?: unknown[]; get?: unknown }[]) {
    const preparedSql: string[] = [];
    return {
        preparedSql,
        close: vi.fn(),
        prepare: (sql: string) => {
            preparedSql.push(sql);
            const entry = handlers.find((h) => h.match(sql));
            return {
                all: (..._params: unknown[]) => entry?.all ?? [],
                get: (..._params: unknown[]) => entry?.get,
            };
        },
    };
}

describe("clampKwicLimit / clampKwicOffset", () => {
    it("defaults and clamps to [1, KWIC_MAX_LIMIT] - a stricter ceiling than the general public API", () => {
        expect(clampKwicLimit(undefined)).toBe(25);
        expect(clampKwicLimit(0)).toBe(25);
        expect(clampKwicLimit(1000)).toBe(KWIC_MAX_LIMIT);
        expect(KWIC_MAX_LIMIT).toBeLessThan(100); // stricter than PUBLIC_API_MAX_LIMIT
    });

    it("defaults offset to 0 and rejects negatives", () => {
        expect(clampKwicOffset(undefined)).toBe(0);
        expect(clampKwicOffset(-1)).toBe(0);
    });
});

describe("searchKwic", () => {
    beforeEach(() => {
        initCorpusDb.mockReset();
    });

    it("rejects a query with more segments than MAX_CQL_SEGMENTS, without touching the DB", () => {
        const tooMany = Array.from({ length: MAX_CQL_SEGMENTS + 1 }, () => `[pos="NOUN"]`).join("");
        expect(() => searchKwic(tooMany, 25, 0)).toThrow(CqlQueryError);
        expect(initCorpusDb).not.toHaveBeenCalled();
    });

    it("wraps a CqlParser syntax error into CqlQueryError", () => {
        expect(() => searchKwic(`pos="NOUN"`, 25, 0)).toThrow(CqlQueryError);
        expect(initCorpusDb).not.toHaveBeenCalled();
    });

    it("returns an empty result without querying documents/sentences/tokens when there are no matches", () => {
        const fakeDb = makeFakeDb([
            { match: (sql) => sql.includes("COUNT(*)"), get: { c: 0 } },
            { match: (sql) => sql.includes("LIMIT ? OFFSET ?"), all: [] },
        ]);
        initCorpusDb.mockReturnValue(fakeDb);

        const result = searchKwic(`[lemma="dom"]`, 25, 0);

        expect(result).toEqual({ items: [], total: 0 });
        expect(fakeDb.close).toHaveBeenCalled();
    });

    it("assembles left/match/right context around a single-segment match", () => {
        const fakeDb = makeFakeDb([
            { match: (sql) => sql.includes("COUNT(*)"), get: { c: 1 } },
            {
                match: (sql) => sql.includes("LIMIT ? OFFSET ?"),
                all: [{ sentenceId: "s1", documentSlug: "doc1", matchStart: 5, matchEnd: 5 }],
            },
            { match: (sql) => sql.includes('"CorpusDocument"'), all: [{ slug: "doc1", title: "Test Doc", author: "Someone" }] },
            { match: (sql) => sql.includes('"CorpusSentence"'), all: [{ id: "s1", rawText: "Ja idu domow." }] },
            {
                match: (sql) => sql.includes('"CorpusToken"') && sql.includes("BETWEEN"),
                all: [
                    { tokenIndex: 4, surfaceForm: "idu", lemma: "iti", pos: "VERB", feats: null },
                    { tokenIndex: 5, surfaceForm: "domow", lemma: "dom", pos: "NOUN", feats: '{"case":"acc"}' },
                    { tokenIndex: 6, surfaceForm: ".", lemma: ".", pos: "PUNCT", feats: null },
                ],
            },
        ]);
        initCorpusDb.mockReturnValue(fakeDb);

        const result = searchKwic(`[lemma="dom"]`, 25, 0);

        expect(result.total).toBe(1);
        expect(result.items).toHaveLength(1);
        const [item] = result.items;
        expect(item.documentTitle).toBe("Test Doc");
        expect(item.left).toEqual([{ surfaceForm: "idu", lemma: "iti", pos: "VERB", feats: null }]);
        expect(item.match).toEqual([{ surfaceForm: "domow", lemma: "dom", pos: "NOUN", feats: { case: "acc" } }]);
        expect(item.right.map((t) => t.surfaceForm)).toEqual(["."]);
    });

    it("wraps the translated query with a documentSlug filter when provided", () => {
        const fakeDb = makeFakeDb([
            { match: (sql) => sql.includes("COUNT(*)"), get: { c: 0 } },
            { match: (sql) => sql.includes("LIMIT ? OFFSET ?"), all: [] },
        ]);
        initCorpusDb.mockReturnValue(fakeDb);

        searchKwic(`[lemma="dom"]`, 25, 0, "doc1");

        const countSql = fakeDb.preparedSql.find((s) => s.includes("COUNT(*)"))!;
        expect(countSql).toContain('WHERE "documentSlug" = ?');
    });

    it("always closes the db connection, even if a query throws", () => {
        const fakeDb = {
            close: vi.fn(),
            prepare: () => {
                throw new Error("boom");
            },
        };
        initCorpusDb.mockReturnValue(fakeDb);

        expect(() => searchKwic(`[lemma="dom"]`, 25, 0)).toThrow("boom");
        expect(fakeDb.close).toHaveBeenCalled();
    });
});
