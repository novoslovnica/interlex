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

// Regression tests for the undiacriticized-spelling gap measured on the live
// corpus (2026-08-24): a third of all word tokens were red, and the two
// biggest causes were (a) the dictionary storing a canonical spelling the
// corpus writes plainly ("język" vs "jezyk", "veľmi" vs "velmi") and (b) the
// citation form of a verb being unreachable at all, since there is no
// infinitive ending in ending_allophones to strip. Same `pos: 'ADP'` trick as
// above: processUninflected returns word.isv verbatim, so these assert the
// matching plumbing, not a declension paradigm.
describe("DbAnalyzer diacritic folding when matching forms", () => {
    it("matches a plainly-spelled surface form against a canonically-spelled lexeme", async () => {
        const word = makeWord({ id: 2, slug: 'velmi-adp', isv: 'veľmi', stem: 'veľmi' });
        const queryWordsByBase = vi.fn(async (bases: string[]) => (bases.includes('velmi') ? [word] : []));

        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());
        const result = await analyzer.analyzeWord('velmi');

        expect(result).not.toBeNull();
        expect(result!.wordSlug).toBe('velmi-adp');
        expect(result!.matchCount).toBe(1);
        expect(result!.isPartialMatch).toBe(false);
    });

    it("still matches when the surface form carries the canonical diacritics", async () => {
        const word = makeWord({ id: 3, slug: 'jezyk-adp', isv: 'język', stem: 'język' });
        const queryWordsByBase = vi.fn(async (bases: string[]) => (bases.includes('język') ? [word] : []));

        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());
        const result = await analyzer.analyzeWord('język');

        expect(result).not.toBeNull();
        expect(result!.matchCount).toBe(1);
        expect(result!.isPartialMatch).toBe(false);
    });

    it("does not fold two genuinely different letters together", async () => {
        // "u" and "o" stay distinct: the fold maps ų/ǫ -> u only, so a
        // West-flavour "o" spelling must NOT silently match here (it is
        // covered by the flavour entries in buildFoldedBaseIndex instead).
        const word = makeWord({ id: 4, slug: 'dom-adp', isv: 'dom', stem: 'dom' });
        const queryWordsByBase = vi.fn(async () => [word]);

        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());
        const result = await analyzer.analyzeWord('dum');

        expect(result!.matchCount).toBe(0);
    });
});

describe("DbAnalyzer numeric tokens", () => {
    it("tags a digits-only token as NUM instead of leaving it unrecognized", async () => {
        const queryWordsByBase = vi.fn(async () => []);
        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());

        const result = await analyzer.analyzeWord('2026');

        expect(result).not.toBeNull();
        expect(result!.pos).toBe('NUM');
        expect(result!.lemma).toBe('2026');
        expect(result!.matchCount).toBe(1);
        expect(result!.wordSlug).toBeNull();
        // Не ходит в словарь вообще — числа там не бывают.
        expect(queryWordsByBase).not.toHaveBeenCalled();
    });

    it("leaves a token that merely contains digits to the normal path", async () => {
        const queryWordsByBase = vi.fn(async () => []);
        const analyzer = new DbAnalyzer(queryWordsByBase, new Set());

        const result = await analyzer.analyzeWord('covid19');

        expect(result).toBeNull();
        expect(queryWordsByBase).toHaveBeenCalled();
    });
});
