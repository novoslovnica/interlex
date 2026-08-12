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

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
    prismaData: { lexeme: { findFirst: (...args: unknown[]) => findFirst(...args) } },
}));

const fetchTranslationsForMeaningIds = vi.fn();
vi.mock("@/lib/translations", () => ({
    fetchTranslationsForMeaningIds: (...args: unknown[]) => fetchTranslationsForMeaningIds(...args),
    TRANSLATION_LANGUAGE_CODES: ["en", "ru"],
}));

import { searchPublicWords, getPublicWordBySlug, clampLimit, clampOffset } from "./words";

describe("clampLimit / clampOffset", () => {
    it("defaults and clamps limit to [1, 100]", () => {
        expect(clampLimit(undefined)).toBe(25);
        expect(clampLimit(NaN)).toBe(25);
        expect(clampLimit(0)).toBe(25);
        expect(clampLimit(-5)).toBe(25);
        expect(clampLimit(50)).toBe(50);
        expect(clampLimit(500)).toBe(100);
    });

    it("defaults offset to 0 and rejects negatives", () => {
        expect(clampOffset(undefined)).toBe(0);
        expect(clampOffset(-1)).toBe(0);
        expect(clampOffset(10)).toBe(10);
    });
});

describe("searchPublicWords", () => {
    beforeEach(() => {
        preparedCalls.length = 0;
        allQueue.length = 0;
        getQueue.length = 0;
    });

    it("always scopes to isPublic = 1, with no search term", async () => {
        queueGet((sql) => sql.includes("COUNT(*)"), { c: 0 });
        queueAll((sql) => sql.includes("SELECT") && !sql.includes("COUNT"), []);
        await searchPublicWords("", 25, 0);
        expect(preparedCalls.every((sql) => sql.includes("isPublic = 1"))).toBe(true);
    });

    it("always scopes to isPublic = 1, with a search term", async () => {
        queueGet((sql) => sql.includes("COUNT(DISTINCT"), { c: 0 });
        queueAll((sql) => sql.includes("SELECT DISTINCT"), []);
        await searchPublicWords("voda", 25, 0);
        expect(preparedCalls.every((sql) => sql.includes("isPublic = 1"))).toBe(true);
    });

    it("never selects internal/moderation-only fields", async () => {
        queueGet(() => true, { c: 0 });
        queueAll(() => true, []);
        await searchPublicWords("", 25, 0);
        await searchPublicWords("voda", 25, 0);
        const forbidden = ["hasAnomalies", "stressPosition", "external_id", "createdAt", "updatedAt"];
        for (const field of forbidden) {
            expect(preparedCalls.some((sql) => sql.includes(field))).toBe(false);
        }
    });

    it("booleanizes properNoun/isCollocation/corpusHapax from raw sqlite integers", async () => {
        queueGet(() => true, { c: 1 });
        queueAll(() => true, [
            { slug: "test-NOUN", value: "test", properNoun: 1, isCollocation: 0, corpusHapax: 1, corpusFrequency: null, corpusFrequencyPerMln: null, corpusRank: null, distributionD: null, cefrLevel: null, transcription: null, mainCategory: null, usageType: null, pos: null, gender: null, aspect: null, transitivity: null, animacy: null, degree: null, pronType: null, numType: null, frequency: null, intelligibility: null, etymology: null, proto: null, paradigm: null, protoStemClass: null, stemExtension: null },
        ]);
        const { items } = await searchPublicWords("", 25, 0);
        expect(items[0].properNoun).toBe(true);
        expect(items[0].isCollocation).toBe(false);
        expect(items[0].corpusHapax).toBe(true);
    });
});

describe("getPublicWordBySlug", () => {
    beforeEach(() => {
        findFirst.mockReset();
        fetchTranslationsForMeaningIds.mockReset();
    });

    it("returns null when no lexeme matches (nonexistent or hidden alike)", async () => {
        findFirst.mockResolvedValueOnce(null);
        const result = await getPublicWordBySlug("does-not-exist");
        expect(result).toBeNull();
    });

    it("filters on isPublic: true explicitly in the Prisma query", async () => {
        findFirst.mockResolvedValueOnce(null);
        await getPublicWordBySlug("hidden-word");
        expect(findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { slug: "hidden-word", isPublic: true } }),
        );
    });

    it("attaches translations per meaning, stripping message/legacyWordId and booleanizing verified", async () => {
        findFirst.mockResolvedValueOnce({
            slug: "voda-NOUN", value: "voda", transcription: null, mainCategory: null, usageType: null,
            pos: "NOUN", gender: "Fem", aspect: null, transitivity: null, animacy: null, degree: null,
            pronType: null, numType: null, frequency: null, intelligibility: null, etymology: null,
            proto: null, paradigm: null, protoStemClass: null, stemExtension: null,
            corpusFrequency: null, corpusFrequencyPerMln: null, corpusRank: null, corpusHapax: null,
            distributionD: null, cefrLevel: "A1", properNoun: false, isCollocation: false,
            meanings: [{ id: 1, meaning: "water", examples: null, meaningVerified: 1, examplesVerified: null }],
        });
        fetchTranslationsForMeaningIds.mockReturnValue({
            en: { 1: [{ id: 10, language: "en", value: "water", verified: 1, message: "internal note", meaningId: 1, legacyWordId: 99 }] },
        });

        const result = await getPublicWordBySlug("voda-NOUN");
        expect(result?.meanings[0].verified).toBe(true);
        expect(result?.meanings[0].translations).toEqual([{ language: "en", value: "water", verified: true }]);
        expect(result?.meanings[0].translations[0]).not.toHaveProperty("message");
        expect(result?.meanings[0].translations[0]).not.toHaveProperty("legacyWordId");
    });
});
