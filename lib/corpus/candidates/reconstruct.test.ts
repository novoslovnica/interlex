import { describe, it, expect, vi } from "vitest";

// getEnding читает ending_allophones из живой БД, а в CI файлов .db нет —
// поэтому цитатные окончания подменяются. Значения взяты те же, что в
// реальной таблице: у o_hard именительный ед. нулевой, у a_hard — "o".
vi.mock("@/lib/grammar/endingLoader", () => ({
    getEnding: (stemType: string) => (stemType === "a_hard" ? "o" : ""),
}));

import { buildHypothesesForSurfaceForm, EndingReverseIndex, StemTypeSupport } from "./reconstruct";

// Пустое окончание есть у нескольких классов сразу — именно оно и порождало
// вырожденный перебор "это может быть им. ед. класса X" для каждого слова.
const REVERSE_INDEX: EndingReverseIndex = new Map([
    ["", [
        { stemType: "o_hard", grammeme: "Case=Nom|Number=Sing" },
        { stemType: "a_hard", grammeme: "Case=Nom|Number=Sing" },
        { stemType: "u_basis", grammeme: "Case=Nom|Number=Sing" },
        { stemType: "consonant_er", grammeme: "Case=Nom|Number=Sing" },
    ]],
    // Непустое окончание — настоящее свидетельство: по нему видно, что
    // фильтр классов работает и вне вырожденного случая.
    ["a", [
        { stemType: "u_basis", grammeme: "Case=Gen|Number=Sing" },
        { stemType: "a_hard", grammeme: "Case=Nom|Number=Sing" },
    ]],
]);

const SUPPORT: StemTypeSupport = new Map([
    ["o_hard", 0.52],
    ["a_hard", 0.17],
    ["u_basis", 0.0014],
    ["consonant_er", 0.001],
]);

describe("buildHypothesesForSurfaceForm pruning", () => {
    it("does not invent letters when only the empty ending matched", () => {
        // Совпало пустое окончание — про морфологию не известно ничего.
        // Единственная защитимая гипотеза: слово уже стоит в словарной форме.
        // Дописать "o" от a_hard значило бы предложить статью "kotъo".
        const hypotheses = buildHypothesesForSurfaceForm("kot", REVERSE_INDEX, SUPPORT);

        expect(hypotheses).toHaveLength(1);
        expect(hypotheses[0].reconstructedForm).toBe("kot");
        expect(hypotheses[0].guessedStemType).toBe("o_hard");
    });

    it("skips stem classes the dictionary barely has", () => {
        const hypotheses = buildHypothesesForSurfaceForm("kot", REVERSE_INDEX, SUPPORT);
        const types = hypotheses.map((h) => h.guessedStemType);

        expect(types).not.toContain("u_basis");
        expect(types).not.toContain("consonant_er");
    });

    it("filters a barely-supported class even when a real ending matched", () => {
        const withSupport = buildHypothesesForSurfaceForm("kota", REVERSE_INDEX, SUPPORT)
            .map((h) => h.guessedStemType);
        expect(withSupport).not.toContain("u_basis");
    });

    it("keeps every class when no support index is supplied", () => {
        // Обратная совместимость: без индекса опоры фильтр классов не
        // применяется, работает только правило про выдуманные буквы.
        const types = buildHypothesesForSurfaceForm("kota", REVERSE_INDEX)
            .map((h) => h.guessedStemType);
        expect(types).toContain("u_basis");
    });

    it("collapses hypotheses that reconstruct the same dictionary entry", () => {
        // o_hard, u_basis и consonant_er дают одну и ту же статью "kot" —
        // для модератора это одно решение, а не три строки.
        const hypotheses = buildHypothesesForSurfaceForm("kot", REVERSE_INDEX);
        const forms = hypotheses.filter((h) => h.reconstructedForm === "kot");

        expect(forms).toHaveLength(1);
    });
});

// Разбор реальной очереди мейнтейнером показал три дыры: не предлагались ни
// начальные формы глаголов (а глаголов в очереди много), ни наречия, а
// фильтр по опоре классов вдобавок молча вырезал и то, и другое — доли по
// словарю считаются только для именных классов, у глагольных их нет и быть
// не может.
const VERB_INDEX: EndingReverseIndex = new Map([
    ["", [{ stemType: "o_hard", grammeme: "Case=Nom|Number=Sing" }]],
    ["t", [{ stemType: "verb_present_athematic_a", grammeme: "Person=3|Number=Plur" }]],
    ["jut", [{ stemType: "verb_present_athematic_a", grammeme: "Person=3|Number=Plur" }]],
    ["te", [{ stemType: "verb_present_athematic_i", grammeme: "Person=2|Number=Plur" }]],
    ["š", [{ stemType: "verb_present_thematic_e", grammeme: "Person=2|Number=Sing" }]],
    ["ěje", [{ stemType: "adverb_comp", grammeme: "Degree=Cmp" }]],
]);

describe("verb and adverb reconstruction", () => {
    const reconstructions = (word: string) =>
        buildHypothesesForSurfaceForm(word, VERB_INDEX, SUPPORT).map((h) => `${h.guessedPos}:${h.reconstructedForm}`);

    it("recovers the infinitive of the short -am paradigm", () => {
        expect(reconstructions("imajut")).toContain("VERB:imati");
    });

    it("recovers the infinitive of an -iti verb", () => {
        expect(reconstructions("govorite")).toContain("VERB:govoriti");
    });

    it("recovers -ovati and -nųti from their thematic stems", () => {
        expect(reconstructions("kupuješ")).toContain("VERB:kupovati");
        expect(reconstructions("krikneš")).toContain("VERB:kriknųti");
    });

    it("refuses to guess a class I infinitive", () => {
        // "mogųt" — основа палатализована (mog-/moć-), инфинитив может быть и
        // на -ti, и на -ći: гипотезы быть не должно вовсе.
        expect(reconstructions("mogut").filter((r) => r.startsWith("VERB:"))).toHaveLength(0);
    });

    it("turns an adverb comparative back into its positive form", () => {
        expect(reconstructions("brzěje")).toContain("ADV:brzo");
    });

    it("offers an adverb reading for the productive -o/-e endings", () => {
        expect(reconstructions("brzo")).toContain("ADV:brzo");
    });

    it("does not apply the dictionary-support filter to verb classes", () => {
        // Регрессия: фильтр опоры сравнивал с порогом ЛЮБОЙ stemType, а у
        // verb_present_* опоры нет — из-за чего вырезались все глагольные
        // гипотезы разом, включая работавшую до того ветку l-причастия.
        const withSupport = buildHypothesesForSurfaceForm("imajut", VERB_INDEX, SUPPORT);
        const withoutSupport = buildHypothesesForSurfaceForm("imajut", VERB_INDEX);
        expect(withSupport.some((h) => h.guessedPos === "VERB")).toBe(true);
        expect(withoutSupport.some((h) => h.guessedPos === "VERB")).toBe(true);
    });
});
