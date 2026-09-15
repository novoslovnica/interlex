import { describe, it, expect } from "vitest"
import { CollocationMatcher } from "./collocationMatcher"
import { NON_TEXT_SPANS, TOKEN_PATTERN } from "./tokenizer"

describe("CollocationMatcher.matchJoined", () => {
    const matcher = new CollocationMatcher([
        { wordSlug: "da by-CCONJ", lemma: "da by", pos: "CCONJ" },
        { wordSlug: "no i-CCONJ", lemma: "no i", pos: "CCONJ" },
    ])

    it("matches a two-word collocation written as one token", () => {
        expect(matcher.matchJoined("daby")?.record.wordSlug).toBe("da by-CCONJ")
        expect(matcher.matchJoined("Daby")?.length).toBe(1)
    })

    it("ignores joins too short to be distinctive", () => {
        expect(matcher.matchJoined("noi")).toBeNull()
    })
})

describe("NON_TEXT_SPANS", () => {
    const tokens = (text: string) => text.replace(NON_TEXT_SPANS, " ").match(TOKEN_PATTERN) ?? []

    it("drops Discord emoji, links and TeX commands before tokenizing", () => {
        expect(tokens("čto tut <:ZLUNSKYSMIEH:879805443709476964> slučilo")).toEqual(["čto", "tut", "slučilo"])
        expect(tokens("sajt https://discord.com/x i www.google.com")).toEqual(["sajt", "i"])
        expect(tokens("{\\displaystyle x}")).toEqual(["{", "x", "}"])
    })
})
