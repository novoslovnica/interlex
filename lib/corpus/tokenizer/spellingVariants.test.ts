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

    it("produces the full cartesian product for multiple occurrences", () => {
        // "uput" has u at two positions -> 2^2 = 4 variants.
        const result = expandSpellingVariants("uput");
        expect(new Set(result)).toEqual(new Set(["uput", "ųput", "upųt", "ųpųt"]));
        expect(result).toHaveLength(4);
        expect(result[0]).toBe("uput");
    });
});
