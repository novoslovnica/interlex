import { describe, it, expect } from "vitest";
import { Tokenizer } from "./tokenizer";

// Regression test for the punctuation/matchCount=0 ambiguity documented in
// AGENTS.md/ARCHITECTURE.md: punctuation tokens used to get no explicit
// matchCount at all, defaulting to 0 - identical, on disk, to a genuinely
// unrecognized ("red") word. Fixed by giving punctuation an explicit,
// unambiguous matchCount of 1 (deterministic, not partial, not ambiguous).
describe("Tokenizer punctuation matchCount", () => {
    it("gives punctuation tokens matchCount=1, not the red-token sentinel 0", async () => {
        const tokens = await Tokenizer.tokenizeSentence("Privet, mir!");
        const punctTokens = tokens.filter((t) => t.isPunctuation);

        expect(punctTokens.length).toBeGreaterThan(0);
        for (const t of punctTokens) {
            expect(t.analysis.matchCount).toBe(1);
        }
    });
});
