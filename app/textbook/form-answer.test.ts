import { describe, expect, it } from "vitest"
import { isFormAnswer } from "./form-answer"

describe("grammar practice answers", () => {
    it("accepts canonical and standard spelling in both scripts and ignores case and stress", () => {
        for (const answer of ["knigų", "KNIGU", "книгѫ", "книгу", "  knigù  "]) {
            expect(isFormAnswer(answer, "knigų")).toBe(true)
        }
        expect(isFormAnswer("книгоју", "knigojų")).toBe(true)
    })

    it("rejects a different form and keeps distinctive letters", () => {
        expect(isFormAnswer("kniga", "knigų")).toBe(false)
        expect(isFormAnswer("noc", "noči")).toBe(false)
    })
})
