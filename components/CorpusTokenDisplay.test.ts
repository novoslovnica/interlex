import { describe, it, expect } from "vitest";
import { normalizeFeatValue } from "./CorpusTokenDisplay";

describe("normalizeFeatValue", () => {
    it("maps a long-form case value (straight from the grammar engine) to its short code", () => {
        expect(normalizeFeatValue("case", "nominative")).toBe("nom");
        expect(normalizeFeatValue("case", "genitive")).toBe("gen");
    });

    it("passes an already-short case code through unchanged", () => {
        expect(normalizeFeatValue("case", "nom")).toBe("nom");
    });

    it("leaves feature keys with no known casing quirk untouched", () => {
        expect(normalizeFeatValue("number", "sg")).toBe("sg");
        expect(normalizeFeatValue("animacy", "anim")).toBe("anim");
    });

    it("capitalizes gender values (defends against pre-2026-08-12 lowercase corpus.db rows)", () => {
        expect(normalizeFeatValue("gender", "masc")).toBe("Masc");
        expect(normalizeFeatValue("gender", "Masc")).toBe("Masc");
        expect(normalizeFeatValue("gender", "fem")).toBe("Fem");
        expect(normalizeFeatValue("gender", "neut")).toBe("Neut");
    });
});
