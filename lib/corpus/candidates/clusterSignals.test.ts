import { describe, it, expect } from "vitest"
import { classifyClusterSignal, inflectedSiblingIndex, FOREIGN_CONTEXT_THRESHOLD } from "./clusterSignals"

const ENDINGS = ["a", "u", "om", "e", "i", "y", "ov", "ah", "ami"]

describe("inflectedSiblingIndex", () => {
    it("links a bare loanword with its forms carrying ISV endings", () => {
        const index = inflectedSiblingIndex(["diskord", "diskordu", "diskorda", "discord", "the"], ENDINGS)
        expect(index.get("diskord")).toEqual(["diskorda", "diskordu"])
        expect(index.get("diskordu")).toEqual(["diskord", "diskorda"])
        expect(index.get("discord")).toEqual([])
        expect(index.get("the")).toEqual([])
    })

    it("does not strip endings down to stems shorter than three letters", () => {
        const index = inflectedSiblingIndex(["oka", "oku"], ENDINGS)
        expect(index.get("oka")).toEqual([])
    })
})

describe("classifyClusterSignal", () => {
    it("rejects English function words unless they are dictionary words", () => {
        expect(classifyClusterSignal({ clusterKey: "the", isvContextShare: 0.43, inflectedSiblings: [], knownAsLexeme: false }))
            .toBe("foreign_function_word")
        expect(classifyClusterSignal({ clusterKey: "the", isvContextShare: 0.43, inflectedSiblings: [], knownAsLexeme: true }))
            .not.toBe("foreign_function_word")
    })

    it("flags a word used in non-Slavic context that never inflects", () => {
        expect(classifyClusterSignal({ clusterKey: "cyrillic", isvContextShare: 0.38, inflectedSiblings: [], knownAsLexeme: false }))
            .toBe("foreign_context")
    })

    it("lets inflection outweigh a foreign-looking context", () => {
        expect(classifyClusterSignal({ clusterKey: "diskord", isvContextShare: 0.4, inflectedSiblings: ["diskordu"], knownAsLexeme: false }))
            .toBeNull()
    })

    it("leaves loanwords used in ISV sentences alone", () => {
        expect(classifyClusterSignal({ clusterKey: "google", isvContextShare: 0.82, inflectedSiblings: [], knownAsLexeme: false }))
            .toBeNull()
        expect(FOREIGN_CONTEXT_THRESHOLD).toBeLessThan(0.82)
    })
})
