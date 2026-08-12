import { describe, it, expect, vi, beforeEach } from "vitest";

const preparedCalls: string[] = [];
const allQueue: { match: (sql: string) => boolean; rows: unknown[] }[] = [];
const getQueue: { match: (sql: string) => boolean; row: unknown }[] = [];
function queueAll(match: (sql: string) => boolean, rows: unknown[]) {
    allQueue.push({ match, rows });
}
function queueGet(match: (sql: string) => boolean, row: unknown) {
    getQueue.push({ match, row });
}

const fakeDb = {
    prepare: (sql: string) => {
        preparedCalls.push(sql);
        return {
            all: (..._params: unknown[]) => {
                const entry = allQueue.find((e) => e.match(sql));
                return entry ? entry.rows : [];
            },
            get: (..._params: unknown[]) => {
                const entry = getQueue.find((e) => e.match(sql));
                return entry ? entry.row : undefined;
            },
        };
    },
};

vi.mock("@/lib/sqlite", () => ({ init: async () => fakeDb }));

import { searchPublicProtoWords, getPublicProtoWordById } from "./proto";

describe("searchPublicProtoWords", () => {
    beforeEach(() => {
        preparedCalls.length = 0;
        allQueue.length = 0;
        getQueue.length = 0;
    });

    it("wraps results in {items, total} and aliases the source_url column to sourceUrl", async () => {
        queueGet((sql) => sql.includes("COUNT"), { c: 2 });
        queueAll((sql) => sql.includes("SELECT"), [{ id: 1, lemma: "voda", body: "...", sourceUrl: "https://example.com" }]);

        const { items, total } = await searchPublicProtoWords("voda", 25, 0);
        expect(total).toBe(2);
        expect(items[0].sourceUrl).toBe("https://example.com");
        expect(preparedCalls.some((sql) => sql.includes("source_url AS sourceUrl"))).toBe(true);
    });

    it("queries without a LIKE filter when search is empty", async () => {
        queueGet(() => true, { c: 0 });
        queueAll(() => true, []);
        await searchPublicProtoWords("", 25, 0);
        expect(preparedCalls.some((sql) => sql.includes("LIKE"))).toBe(false);
    });
});

describe("getPublicProtoWordById", () => {
    beforeEach(() => {
        preparedCalls.length = 0;
        allQueue.length = 0;
        getQueue.length = 0;
    });

    it("returns null for a nonexistent id", async () => {
        getQueue.push({ match: () => true, row: undefined });
        const result = await getPublicProtoWordById(999);
        expect(result).toBeNull();
    });

    it("includes the morphemes relation for a found word", async () => {
        getQueue.push({ match: (sql) => sql.includes("proto_slavic_words"), row: { id: 1, lemma: "voda", body: "...", sourceUrl: "" } });
        allQueue.push({ match: (sql) => sql.includes("morphemes"), rows: [{ value: "vod", meaning: "water" }] });

        const result = await getPublicProtoWordById(1);
        expect(result?.morphemes).toEqual([{ value: "vod", meaning: "water" }]);
    });
});
