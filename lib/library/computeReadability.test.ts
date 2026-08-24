import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WordBaseRecord } from "@/lib/corpus/tokenizer/dbAnalyzer";

// Синтетические ADP-слова: pos='ADP' в DbAnalyzer идёт по неизменяемой
// ветке (возвращает word.isv как есть), поэтому не тянет за собой реальную
// парадигму склонения/спряжения — тот же приём, что и в dbAnalyzer.test.ts
// (см. sut/sųt regression test), нужен только чтобы controllable-словами
// управлять тем, что считается "распознанным" словом в тесте.
const TEST_WORDS: (WordBaseRecord & { cefrLevel: string })[] = [
    { id: 1, slug: "alfa-adp", isv: "alfa", pos: "ADP", protoStemClass: null, stemExtension: null, paradigm: null, stem: "alfa", base: null, gender: null, animacy: null, alternationType: null, fleetingVowelAt: null, cefrLevel: "A1" },
    { id: 2, slug: "beta-adp", isv: "beta", pos: "ADP", protoStemClass: null, stemExtension: null, paradigm: null, stem: "beta", base: null, gender: null, animacy: null, alternationType: null, fleetingVowelAt: null, cefrLevel: "C1" },
];

const queryWordsByBaseSpy = vi.fn(async (bases: string[]) => {
    return TEST_WORDS.filter(w => bases.includes(w.isv!));
});

vi.mock("@/lib/corpus/tokenizer/analyzer-factory", async () => {
    const { DbAnalyzer } = await import("@/lib/corpus/tokenizer/dbAnalyzer");
    return {
        // computeReadability собирает анализатор одной фабрикой
        // (createDbAnalyzer), поэтому мок подменяет её целиком, а не
        // четыре отдельных билдера, как раньше. queryWordsByBaseSpy
        // остаётся тем же управляемым источником "known words".
        createDbAnalyzer: async () => new DbAnalyzer(queryWordsByBaseSpy, new Set<string>([""]), [], new Map()),
    };
});

const findMany = vi.fn(async ({ where }: { where: { slug: { in: string[] } } }) => {
    return TEST_WORDS.filter(w => where.slug.in.includes(w.slug)).map(w => ({ slug: w.slug, cefrLevel: w.cefrLevel }));
});
vi.mock("@/lib/prisma", () => ({
    prismaData: { lexeme: { findMany: (...args: unknown[]) => findMany(...(args as [{ where: { slug: { in: string[] } } }])) } },
}));

import { computeReadability } from "./computeReadability";

describe("computeReadability", () => {
    beforeEach(() => {
        queryWordsByBaseSpy.mockClear();
        findMany.mockClear();
    });

    it("returns nulls for text with no word-like tokens", async () => {
        const result = await computeReadability("   ...  --- !!!  ");
        expect(result).toEqual({ score: null, level: null, coverage: 0 });
    });

    it("averages CEFR levels of recognized words, weighted by occurrence", async () => {
        // alfa (A1=1) x2, beta (C1=5) x1 -> (1+1+5)/3 = 2.33 -> round 2 -> A2
        const result = await computeReadability("alfa alfa beta");
        expect(result.coverage).toBe(1);
        expect(result.score).toBeCloseTo(7 / 3, 5);
        expect(result.level).toBe("A2");
    });

    it("returns null score/level when coverage falls below the trust threshold", async () => {
        // 1 recognized ("alfa") out of 4 word tokens = 0.25 coverage < 0.3
        const result = await computeReadability("unknown1 unknown2 unknown3 alfa");
        expect(result.coverage).toBeCloseTo(0.25, 5);
        expect(result.score).toBeNull();
        expect(result.level).toBeNull();
    });

    it("caches repeated tokens within one call instead of re-querying the DB", async () => {
        await computeReadability("alfa alfa alfa alfa");
        // 4 occurrences of the same token, but only one should reach queryWordsByBase.
        expect(queryWordsByBaseSpy).toHaveBeenCalledTimes(1);
    });

    it("only looks up cefrLevel for the distinct slugs actually resolved", async () => {
        await computeReadability("alfa alfa beta");
        expect(findMany).toHaveBeenCalledWith({
            where: { slug: { in: expect.arrayContaining(["alfa-adp", "beta-adp"]) } },
            select: { slug: true, cefrLevel: true },
        });
        expect((findMany.mock.calls[0][0] as { where: { slug: { in: string[] } } }).where.slug.in).toHaveLength(2);
    });
});
