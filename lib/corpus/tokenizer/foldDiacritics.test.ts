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

    it("writes a soft consonant before a back vowel with j, as plain spelling does", () => {
        expect(foldDiacritics("stolěťa")).toBe("stoletja");
        expect(foldDiacritics("końa")).toBe("konja");
        expect(foldDiacritics("ľudi")).toBe("ljudi");
        expect(foldDiacritics("zemľų")).toBe("zemlju");
        // no j before front vowels, matching normalizeSoftConsonants
        expect(foldDiacritics("pęťe")).toBe("pete");
        // ć/đ are č/dž in plain spelling, never followed by j
        expect(foldDiacritics("noća")).toBe("noca");
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

    it("strips stress marks outside the table, precomposed or combining", () => {
        expect(foldDiacritics("tògda")).toBe("togda");
        expect(foldDiacritics("tògda")).toBe("togda");
        expect(foldDiacritics("dȁn")).toBe("dan");
        // Cyrillic letters with a built-in diacritic are left alone
        expect(foldDiacritics("мой")).toBe("мой");
    });

    it("is idempotent and leaves undiacriticized text alone", () => {
        const plain = "jezyk pisati velmi stoletja";
        expect(foldDiacritics(plain)).toBe(plain);
        expect(foldDiacritics(foldDiacritics("języku"))).toBe(foldDiacritics("języku"));
        expect(foldDiacritics(foldDiacritics("stolěťa"))).toBe("stoletja");
    });
});

describe("đ and dž are the same letter in two orthographies", () => {
    it("folds đ where dž folds, so the dictionary stem meets the corpus spelling", () => {
        // Стем словаря пишется через đ, корпус — через dž (18 228 токенов
        // medžu- против 419 među-). Раньше đ сворачивалась в голое d, и слово
        // не находилось ни в одной форме.
        expect(foldDiacritics("međuslovjańsk")).toBe(foldDiacritics("medžuslovjansk"));
        expect(foldDiacritics("međuslovjańsk")).toBe("medzuslovjansk");
        expect(foldDiacritics("rođeńje")).toBe(foldDiacritics("rodženje"));
        expect(foldDiacritics("prěđe")).toBe(foldDiacritics("predže"));
    });

    it("keeps matching the plain dz spelling the dictionary uses in value", () => {
        // medža-n: value "medza", stem "medž" — обе стороны дают medz.
        expect(foldDiacritics("medž")).toBe("medz");
        expect(foldDiacritics("medza")).toBe("medza");
    });
});
