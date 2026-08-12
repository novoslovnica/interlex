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

    it("leaves non-case feature keys untouched", () => {
        expect(normalizeFeatValue("number", "sg")).toBe("sg");
        expect(normalizeFeatValue("gender", "masc")).toBe("masc");
    });
});
