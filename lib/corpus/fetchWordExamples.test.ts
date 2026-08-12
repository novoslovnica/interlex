import { describe, it, expect, vi, beforeEach } from "vitest";

const corpusTokenFindMany = vi.fn();
const corpusSentenceFindMany = vi.fn();
const corpusDocumentFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
    prismaCorpus: {
        corpusToken: { findMany: (...args: unknown[]) => corpusTokenFindMany(...args) },
        corpusSentence: { findMany: (...args: unknown[]) => corpusSentenceFindMany(...args) },
        corpusDocument: { findMany: (...args: unknown[]) => corpusDocumentFindMany(...args) },
    },
}));

import { fetchWordExamples } from "./fetchWordExamples";

describe("fetchWordExamples", () => {
    beforeEach(() => {
        corpusTokenFindMany.mockReset();
        corpusSentenceFindMany.mockReset();
        corpusDocumentFindMany.mockReset();
    });

    it("returns [] without querying when wordSlug is empty", async () => {
        const result = await fetchWordExamples("");
        expect(result).toEqual([]);
        expect(corpusTokenFindMany).not.toHaveBeenCalled();
    });

    it("returns [] when no tokens match", async () => {
        corpusTokenFindMany.mockResolvedValue([]);
        const result = await fetchWordExamples("byti-VERB");
        expect(result).toEqual([]);
        expect(corpusSentenceFindMany).not.toHaveBeenCalled();
    });

    it("dedupes multiple tokens landing in the same sentence before slicing to the limit", async () => {
        corpusTokenFindMany.mockResolvedValue([
            { sentenceId: "s1", surfaceForm: "jest" },
            { sentenceId: "s1", surfaceForm: "jest" }, // same sentence again - must be deduped
            { sentenceId: "s2", surfaceForm: "byti" },
            { sentenceId: "s3", surfaceForm: "byti" },
        ]);
        corpusSentenceFindMany.mockResolvedValue([
            { id: "s1", rawText: "On jest dobry.", documentSlug: "doc-a" },
            { id: "s2", rawText: "Byti ili ne byti.", documentSlug: "doc-a" },
            { id: "s3", rawText: "Ja hoču byti tu.", documentSlug: "doc-b" },
        ]);
        corpusDocumentFindMany.mockResolvedValue([
            { slug: "doc-a", title: "Doc A", sourceUrl: "https://example.com/a" },
            { slug: "doc-b", title: "Doc B", sourceUrl: null },
        ]);

        const result = await fetchWordExamples("byti-VERB", 2);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            sentenceId: "s1",
            text: "On jest dobry.",
            surfaceForm: "jest",
            documentTitle: "Doc A",
            documentSlug: "doc-a",
            sourceUrl: "https://example.com/a",
        });
        expect(result[1]).toEqual({
            sentenceId: "s2",
            text: "Byti ili ne byti.",
            surfaceForm: "byti",
            documentTitle: "Doc A",
            documentSlug: "doc-a",
            sourceUrl: "https://example.com/a",
        });
    });

    it("falls back to the document slug as title when the document row is missing", async () => {
        corpusTokenFindMany.mockResolvedValue([{ sentenceId: "s1", surfaceForm: "vlk" }]);
        corpusSentenceFindMany.mockResolvedValue([
            { id: "s1", rawText: "Vlk vyje.", documentSlug: "orphan-doc" },
        ]);
        corpusDocumentFindMany.mockResolvedValue([]);

        const result = await fetchWordExamples("vlk-NOUN");

        expect(result).toHaveLength(1);
        expect(result[0].documentTitle).toBe("orphan-doc");
        expect(result[0].sourceUrl).toBeNull();
    });
});
