import { describe, it, expect } from "vitest";
import { expandSpellingVariants } from "./spellingVariants";

describe("expandSpellingVariants", () => {
    it("returns the original form first when there is nothing to expand", () => {
        expect(expandSpellingVariants("kost")).toEqual(["kost"]);
    });

    it("adds the canonical ų variant for a single plain u", () => {
        const result = expandSpellingVariants("sut");
        expect(result).toContain("sut");
        expect(result).toContain("sųt");
        expect(result).toHaveLength(2);
        expect(result[0]).toBe("sut");
    });

    it("does not widen a form that is already spelled with the canonical letter", () => {
        expect(expandSpellingVariants("sųt")).toEqual(["sųt"]);
    });

    it("tries y for an i written after a consonant", () => {
        expect(expandSpellingVariants("bil")).toEqual(["bil", "byl"]);
        // "drugih" also has a u, so ų-variants are expected alongside.
        expect(expandSpellingVariants("drugih")).toContain("drugyh");
    });

    it("keeps i as i at the start of a word, after a vowel and after j", () => {
        expect(expandSpellingVariants("ime")).toEqual(["ime"]);
        expect(expandSpellingVariants("moi")).toEqual(["moi"]);
        expect(expandSpellingVariants("jih")).toEqual(["jih"]);
    });

    it("caps the number of variants for long words", () => {
        const result = expandSpellingVariants("inicijativnimi");
        expect(result[0]).toBe("inicijativnimi");
        expect(result.length).toBeLessThanOrEqual(64);
    });

    it("produces the full cartesian product for multiple occurrences", () => {
        // "uput" has u at two positions -> 2^2 = 4 variants.
        const result = expandSpellingVariants("uput");
        expect(new Set(result)).toEqual(new Set(["uput", "ųput", "upųt", "ųpųt"]));
        expect(result).toHaveLength(4);
        expect(result[0]).toBe("uput");
    });
});

describe("dž stands in for the canonical đ", () => {
    it("offers the đ spelling the dictionary stem uses", () => {
        const variants = expandSpellingVariants("medžuslovjanskogo");
        expect(variants[0]).toBe("medžuslovjanskogo");
        expect(variants).toContain("međuslovjanskogo");
    });

    it("leaves words without the digraph alone", () => {
        expect(expandSpellingVariants("dom")).toEqual(["dom"]);
    });
});
