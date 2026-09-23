import { describe, expect, it } from "vitest"
import { canonicalFromStem } from "./stem"

describe("canonicalFromStem", () => {
    it("takes the stem when it differs from the value only by diacritics", () => {
        expect(canonicalFromStem("treba", "trěba")).toBe("trěba")
        expect(canonicalFromStem("velmi", "veľmi")).toBe("veľmi")
    })
    it("completes a stem that lacks the final vowel with the value's tail", () => {
        expect(canonicalFromStem("takoze", "takož")).toBe("takože")
        expect(canonicalFromStem("jesce", "ješč")).toBe("ješče")
        expect(canonicalFromStem("nekoliko", "několik")).toBe("několiko")
        expect(canonicalFromStem("dobrovoljno", "dobrovoljn")).toBe("dobrovoljno")
    })
    it("keeps the value when the stem is something else", () => {
        expect(canonicalFromStem("de", "gd")).toBe("de")
        expect(canonicalFromStem("voda", "")).toBe("voda")
        expect(canonicalFromStem("bardzo", "bard")).toBe("bardzo")
    })
})
