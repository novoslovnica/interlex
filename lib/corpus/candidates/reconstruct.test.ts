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
