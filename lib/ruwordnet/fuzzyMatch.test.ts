import { describe, it, expect, vi, beforeEach } from "vitest";

const preparedAll = vi.fn();
vi.mock("better-sqlite3", () => ({
    // vi.fn() mocks a class here (called with `new`) - the implementation
    // must be a regular function, not an arrow function, since arrow
    // functions can't be used as constructors.
    default: vi.fn().mockImplementation(function () {
        return { prepare: () => ({ all: preparedAll }) };
    }),
}));

vi.mock("fs", () => ({
    default: {
        existsSync: vi.fn(() => true),
        readdirSync: vi.fn(() => ["python3.14"]),
    },
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn(() => ["python3.14"]),
}));

import { findFuzzyLemmaCandidates } from "./fuzzyMatch";

describe("findFuzzyLemmaCandidates", () => {
    beforeEach(() => {
        preparedAll.mockReset();
    });

    it("suggests a lemma one edit away, matching the documented ту вычитка текста / вычитка текст gap", () => {
        preparedAll.mockReturnValue([{ lemma: "ВЫЧИТКА ТЕКСТ" }, { lemma: "СОВЕРШЕННО НЕПОХОЖЕЕ" }]);
        const result = findFuzzyLemmaCandidates("вычитка текста");
        expect(result).toEqual(["вычитка текст"]);
    });

    it("sorts by edit distance ascending, then alphabetically", () => {
        preparedAll.mockReturnValue([{ lemma: "СЕКТА" }, { lemma: "ТЕКСТ" }, { lemma: "ВЕРСТА" }]);
        const result = findFuzzyLemmaCandidates("текста");
        // ТЕКСТ is distance 1 (drop trailing А); СЕКТА/ВЕРСТА are distance 2
        expect(result).toEqual(["текст", "верста", "секта"]);
    });

    it("dedupes case-insensitively and respects the limit", () => {
        preparedAll.mockReturnValue([{ lemma: "ТЕКСТ" }, { lemma: "текст" }, { lemma: "ТЕКСТЫ" }]);
        const result = findFuzzyLemmaCandidates("текста", 1);
        expect(result).toEqual(["текст"]);
    });

    it("excludes an exact match (distance 0) and words with no near match", () => {
        preparedAll.mockReturnValue([{ lemma: "ТЕКСТ" }]);
        expect(findFuzzyLemmaCandidates("текст")).toEqual([]);

        preparedAll.mockReturnValue([{ lemma: "СОВЕРШЕННО НЕПОХОЖЕЕ" }]);
        expect(findFuzzyLemmaCandidates("другоеслово")).toEqual([]);
    });

    it("returns an empty array for an empty query", () => {
        expect(findFuzzyLemmaCandidates("   ")).toEqual([]);
        expect(preparedAll).not.toHaveBeenCalled();
    });
});
