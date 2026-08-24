import { describe, it, expect, vi } from "vitest";

// Fixtures mirror the two real cases the folded base index exists for
// (measured on the live corpus 2026-08-24):
//  - "pisati": base_homonyms only ever holds the stem "pisa", and there is no
//    infinitive ending in ending_allophones to strip, so the citation form
//    itself was unreachable — 66 815 corpus tokens.
//  - "język": the dictionary spelling carries diacritics the corpus writes
//    plainly ("jezyk", also stored as its own WEST allophone row).
const LEXEMES = [
    { id: 10, value: "pisati", stem: "pisa" },
    { id: 20, value: "jezyk", stem: "język" },
];
const ALLOPHONES = [
    { lexemeId: 20, value: "język" },
    { lexemeId: 20, value: "jezyk" },
];
const BASE_HOMONYMS = [
    { base: "pisa", wordIds: "[10]" },
    { base: "język", wordIds: '[{"id":20,"flavor":"CORE"}]' },
];

const baseHomonymFindMany = vi.fn(async (args?: { where?: { base?: { in: string[] } } }) => {
    const filter = args?.where?.base?.in;
    return filter ? BASE_HOMONYMS.filter((h) => filter.includes(h.base)) : BASE_HOMONYMS;
});
const lexemeFindMany = vi.fn(async (args?: { where?: { id?: { in: number[] } } }) => {
    const filter = args?.where?.id?.in;
    const rows = filter ? LEXEMES.filter((l) => filter.includes(l.id)) : LEXEMES;
    return rows.map((l) => ({ ...l, slug: `${l.value}-x`, pos: "ADP", protoStemClass: null, stemExtension: null, paradigm: null, gender: null, animacy: null, isCollocation: false, corpusFrequencyPerMln: 1 }));
});

vi.mock("@/lib/prisma", () => ({
    prismaData: {
        lexeme: { findMany: (...a: unknown[]) => lexemeFindMany(...(a as [never])) },
        lexemeAllophone: { findMany: async () => ALLOPHONES },
        baseHomonym: { findMany: (...a: unknown[]) => baseHomonymFindMany(...(a as [never])) },
        endingAllophone: { findMany: async () => [{ value: "ų" }, { value: "a" }] },
        inflectionAnomaly: { findMany: async () => [] },
    },
}));

import { buildFoldedBaseIndex, createQueryWordsByBase, buildValidEndings } from "./analyzer-factory";

describe("buildFoldedBaseIndex", () => {
    it("indexes the citation form, so a verb infinitive is reachable without an infinitive ending", async () => {
        const index = await buildFoldedBaseIndex();
        expect(index.get("pisati")).toContain(10);
        expect(index.get("pisa")).toContain(10);
    });

    it("indexes canonical and plain spellings under the same folded key", async () => {
        const index = await buildFoldedBaseIndex();
        expect(index.get("jezyk")).toContain(20);
    });
});

describe("createQueryWordsByBase with a folded index", () => {
    it("finds a lexeme whose canonical base differs from the queried one only by diacritics", async () => {
        const index = await buildFoldedBaseIndex();
        const rows = await createQueryWordsByBase(index)(["jezyk"]);
        expect(rows.map((r) => r.id)).toContain(20);
    });

    it("returns nothing extra when the folded index is not supplied", async () => {
        const rows = await createQueryWordsByBase()(["jezyk"]);
        expect(rows).toHaveLength(0);
    });
});

describe("buildValidEndings", () => {
    it("adds the folded variant of every ending, so undiacriticized forms can be split", async () => {
        const endings = await buildValidEndings();
        expect(endings.has("ų")).toBe(true);
        expect(endings.has("u")).toBe(true);
    });
});
