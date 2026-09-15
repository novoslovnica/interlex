import { describe, it, expect } from "vitest"
import { dropFleetingVowel, softStemWithJ } from "../declineNoun"

describe("dropFleetingVowel", () => {
    it("drops ė/ȯ of the final closed syllable before a vowel ending", () => {
        expect(dropFleetingVowel("članėk", "a", "")).toBe("člank")
        expect(dropFleetingVowel("sȯn", "a", "")).toBe("sn")
        expect(dropFleetingVowel("afrikanėc", "i", "")).toBe("afrikanc")
    })

    it("keeps the jer before a zero ending", () => {
        expect(dropFleetingVowel("članėk", "", "")).toBe("članėk")
    })

    it("keeps it when the citation form already has a vowel ending", () => {
        expect(dropFleetingVowel("dȯsk", "y", "a")).toBe("dȯsk")
    })

    it("leaves stems without a final-syllable jer alone", () => {
        expect(dropFleetingVowel("članek", "a", "")).toBe("članek")
        expect(dropFleetingVowel("vȯzduh", "a", "")).toBe("vȯzduh")
    })
})

describe("softStemWithJ", () => {
    it("adds j to soft stems stored without it", () => {
        expect(softStemWithJ("pol", "a_soft")).toBe("polj")
        expect(softStemWithJ("rosi", "a_soft")).toBe("rosij")
        expect(softStemWithJ("učitel", "o_soft")).toBe("učitelj")
    })

    it("writes a final soft consonant with j", () => {
        expect(softStemWithJ("stolěť", "a_soft")).toBe("stolětj")
        expect(softStemWithJ("konь", "o_hard")).toBe("konь")
    })

    it("does not touch stems that are already soft or hard stem types", () => {
        expect(softStemWithJ("duš", "a_soft")).toBe("duš")
        expect(softStemWithJ("sŕdc", "a_soft")).toBe("sŕdc")
        expect(softStemWithJ("konj", "o_soft")).toBe("konj")
        expect(softStemWithJ("narod", "o_hard")).toBe("narod")
    })
})
