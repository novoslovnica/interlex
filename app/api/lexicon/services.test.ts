import { describe, it, expect, vi, beforeEach } from "vitest";

const preparedCalls: string[] = [];
const allQueue: { match: (sql: string) => boolean; rows: unknown[] }[] = [];
function queueAll(match: (sql: string) => boolean, rows: unknown[]) {
    allQueue.push({ match, rows });
}

const fakeDb = {
    prepare: (sql: string) => {
        preparedCalls.push(sql);
        return {
            all: (..._params: unknown[]) => {
                const entry = allQueue.find((e) => e.match(sql));
                return entry ? entry.rows : [];
            },
        };
    },
};

vi.mock("@/lib/sqlite", () => ({ init: async () => fakeDb }));

const fetchTranslationsForMeaningIds = vi.fn();
vi.mock("@/lib/translations", () => ({
    fetchTranslationsForMeaningIds: (...args: unknown[]) => fetchTranslationsForMeaningIds(...args),
}));

import { getDictItems, getReverseDictItems } from "./services";

describe("getReverseDictItems", () => {
    beforeEach(() => {
        preparedCalls.length = 0;
        allQueue.length = 0;
        fetchTranslationsForMeaningIds.mockReset();
        fetchTranslationsForMeaningIds.mockReturnValue({});
    });

    it("returns [] without querying the DB when search or language is empty", async () => {
        expect(await getReverseDictItems("", "ru", 0, 50)).toEqual([]);
        expect(await getReverseDictItems("вода", "", 0, 50)).toEqual([]);
        expect(preparedCalls.length).toBe(0);
    });

    it("queries translations joined through meanings, scoped to isPublic = 1 by default", async () => {
        queueAll((sql) => sql.includes("JOIN translations"), []);
        await getReverseDictItems("вода", "ru", 0, 50);
        const idQuery = preparedCalls.find((sql) => sql.includes("JOIN translations"));
        expect(idQuery).toBeDefined();
        expect(idQuery).toContain("JOIN meanings");
        expect(idQuery).toContain("t.language = ?");
        expect(idQuery).toContain("l.isPublic = 1");
    });

    it("does not scope to isPublic when includeHidden is true", async () => {
        queueAll((sql) => sql.includes("JOIN translations"), []);
        await getReverseDictItems("вода", "ru", 0, 50, true);
        const idQuery = preparedCalls.find((sql) => sql.includes("JOIN translations"));
        expect(idQuery).not.toContain("isPublic");
    });

    it("returns [] early when no lexeme ids match, without a second query", async () => {
        queueAll((sql) => sql.includes("JOIN translations"), []);
        const result = await getReverseDictItems("нет-такого-слова", "ru", 0, 50);
        expect(result).toEqual([]);
        expect(preparedCalls.some((sql) => sql.includes("la_core.value"))).toBe(false);
    });

    it("enriches matched lexeme ids into full result items", async () => {
        queueAll((sql) => sql.includes("JOIN translations"), [{ id: 42 }]);
        queueAll((sql) => sql.includes("la_core.value"), [
            { id: 42, isv: "vòda", value: "voda", slug: "voda-NOUN", pos: "NOUN" },
        ]);
        queueAll((sql) => sql.includes("FROM meanings"), [{ id: 7, lexemeId: 42, meaning: "water", examples: null }]);
        queueAll((sql) => sql.includes("FROM lexeme_allophones la"), []);
        queueAll((sql) => sql.includes("FROM lexemes WHERE"), []);
        fetchTranslationsForMeaningIds.mockReturnValue({ ru: { 7: [{ language: "ru", value: "вода", verified: 1 }] } });

        const result = await getReverseDictItems("вода", "ru", 0, 50);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(42);
        expect(result[0].meaningText).toBe("water");
        expect(result[0].ru).toEqual([{ language: "ru", value: "вода", verified: 1 }]);
    });
});

describe("getDictItems (regression after enrichLexemeRows extraction)", () => {
    beforeEach(() => {
        preparedCalls.length = 0;
        allQueue.length = 0;
        fetchTranslationsForMeaningIds.mockReset();
        fetchTranslationsForMeaningIds.mockReturnValue({});
    });

    it("still scopes the unfiltered listing branch to isPublic = 1", async () => {
        queueAll((sql) => sql.includes("FROM lexemes l"), []);
        await getDictItems("", 0, 20);
        const listQuery = preparedCalls.find((sql) => sql.includes("ORDER BY l.id ASC"));
        expect(listQuery).toContain("l.isPublic = 1");
    });
});
