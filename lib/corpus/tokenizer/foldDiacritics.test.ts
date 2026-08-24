import { describe, it, expect } from "vitest";
import { foldDiacritics } from "./foldDiacritics";

describe("foldDiacritics", () => {
    it("folds the nasal vowels and yat the way standardToSimple does", () => {
        expect(foldDiacritics("język")).toBe("jezyk");
        expect(foldDiacritics("sųt")).toBe("sut");
        expect(foldDiacritics("dělati")).toBe("delati");
    });

    it("folds soft consonants to their plain letter", () => {
        expect(foldDiacritics("veľmi")).toBe("velmi");
        expect(foldDiacritics("pęť")).toBe("pet");
        expect(foldDiacritics("noć")).toBe("noc");
    });

    it("keeps the folds the old DbAnalyzer.normalizeForm already did", () => {
        expect(foldDiacritics("človek")).toBe("clovek");
        expect(foldDiacritics("žena")).toBe("zena");
        expect(foldDiacritics("sȯn")).toBe("son");
        expect(foldDiacritics("domъ")).toBe("dom");
    });

    it("folds the precomposed tone/length marks the grammar engine emits", () => {
        // stripCombiningAccents only removes U+0300..U+0311; these are
        // precomposed characters and used to survive into the form index,
        // making "gråd"/"smŕť" unmatchable against corpus "grad"/"smrti".
        expect(foldDiacritics("gråd")).toBe("grad");
        expect(foldDiacritics("smŕť")).toBe("smrt");
        expect(foldDiacritics("dėn")).toBe("den");
    });

    it("is idempotent and leaves undiacriticized text alone", () => {
        const plain = "jezyk pisati velmi";
        expect(foldDiacritics(plain)).toBe(plain);
        expect(foldDiacritics(foldDiacritics("języku"))).toBe(foldDiacritics("języku"));
    });
});
