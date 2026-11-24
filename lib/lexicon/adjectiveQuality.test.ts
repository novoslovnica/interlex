import { describe, expect, it } from "vitest"
import { MorphemeType } from "@/lib/grammar/common/morpheme"
import { findSuffixCandidates, hasAdjectiveStemMismatch } from "./adjectiveQuality"

describe("adjective quality report", () => {
    it("suggests suffixes for review across spelling variants", () => {
        expect(findSuffixCandidates(
            { value: "#domovy, aluminijevy, slovjańsky", stem: null },
            [],
        )).toEqual(["ov", "ev", "sk"])
    })

    it("skips an attached suffix and strings already covered by an attached root", () => {
        expect(findSuffixCandidates(
            { value: "domovy", stem: "domov" },
            [{ value: "-ов-", type: MorphemeType.SUFFIX }],
        )).toEqual([])
        expect(findSuffixCandidates(
            { value: "novy", stem: "nov" },
            [{ value: "nov", type: MorphemeType.ROOT }],
        )).toEqual([])
    })

    it("ignores spelling differences and the adjective ending when comparing stems", () => {
        expect(hasAdjectiveStemMismatch({ value: "slovjansky, novy", stem: "slovjańsk, nov" })).toBe(false)
        expect(hasAdjectiveStemMismatch({ value: "slovjansky", stem: "slov" })).toBe(true)
    })
})
