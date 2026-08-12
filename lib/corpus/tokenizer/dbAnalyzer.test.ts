import { describe, it, expect, vi } from "vitest";
import { DbAnalyzer, WordBaseRecord } from "./dbAnalyzer";

// Regression test for the real-world "sut" vs "sųt" gap documented in
// AGENTS.md/ARCHITECTURE.md: the far more common undiacriticized spelling
// "sut" used to be unrecognizable because generateHypotheticalBases("sut")
// never produced "sųt" as a candidate base, so a lexeme stored with the
// canonical nasal-vowel stem was never even queried for. Uses `pos: 'ADP'`
// (routes to processUninflected, which returns word.isv verbatim) so the
// test doesn't depend on any real declension/conjugation paradigm - only on
// the base-widening plumbing in analyzeWord/matchForms/generateHypotheticalBases.
function makeWord(overrides: Partial<WordBaseRecord>): WordBaseRecord {
    return {
        id: 1,
        slug: 'sut-adp',
        isv: 'sųt',
        pos: 'ADP',
        protoStemClass: null,
        stemExtension: null,
        paradigm: null,
        stem: 'sųt',
        base: null,
        gender: null,
        animacy: null,
        alternationType: null,
        fleetingVowelAt: null,
        ...overrides,
    };
}

describe("DbAnalyzer u/ų spelling-variant widening", () => {
    it("finds a canonically-ų-spelled lexeme when the surface form is plainly spelled with u", async () => {
        const word = makeWord({});
        const queryWordsByBase = vi.fn(async (bases: string[]) => {
            return bases.includes('sųt') ? [word] : [];
        });

        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());
        const result = await analyzer.analyzeWord('sut');

        expect(queryWordsByBase).toHaveBeenCalled();
        const requestedBases = queryWordsByBase.mock.calls[0][0] as string[];
        expect(requestedBases).toEqual(expect.arrayContaining(['sut', 'sųt']));

        expect(result).not.toBeNull();
        expect(result!.wordSlug).toBe('sut-adp');
        expect(result!.matchCount).toBe(1);
        expect(result!.isPartialMatch).toBe(false);
    });

    it("still resolves the canonical ų spelling directly without needless widening", async () => {
        const word = makeWord({});
        const queryWordsByBase = vi.fn(async (bases: string[]) => {
            return bases.includes('sųt') ? [word] : [];
        });

        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());
        const result = await analyzer.analyzeWord('sųt');

        const requestedBases = queryWordsByBase.mock.calls[0][0] as string[];
        expect(requestedBases).toEqual(['sųt']);

        expect(result).not.toBeNull();
        expect(result!.wordSlug).toBe('sut-adp');
    });

    it("returns null when neither spelling matches anything", async () => {
        const queryWordsByBase = vi.fn(async () => []);
        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());
        const result = await analyzer.analyzeWord('xyzzy');
        expect(result).toBeNull();
    });
});
