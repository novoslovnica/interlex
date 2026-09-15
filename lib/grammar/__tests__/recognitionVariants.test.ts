import { describe, it, expect } from "vitest"
import { generateWordForms } from "@/lib/grammar/morphology/engine"
import { EngineWordInput } from "@/lib/grammar/morphology"

function forms(input: Partial<EngineWordInput> & { isv: string; pos: string }): Set<string> {
    return new Set(generateWordForms({ id: 1, slug: "test", flavor: "CORE", ...input }, true).map((f) => f.surfaceForm))
}

describe("collocation flag", () => {
    it("still declines a single-word spelling variant of a flagged lexeme", () => {
        // "imeti, imati" is flagged only because of the space after the comma.
        const f = forms({ isv: "imeti", pos: "AUX", stem: "iměti", isCollocation: true })
        expect(f.has("iměl")).toBe(true)
        expect(f.has("imam")).toBe(true)
    })

    it("keeps a real multi-word collocation invariant", () => {
        expect([...forms({ isv: "da by", pos: "CCONJ", isCollocation: true })]).toEqual(["da by"])
    })
})

describe("s-stems", () => {
    it("recognise the regular neuter forms next to the sloves- ones", () => {
        const f = forms({ isv: "slovo", pos: "NOUN", stem: "slov", protoStemClass: "consonant", stemExtension: "es", gender: "Neut" })
        for (const form of ["slovese", "slova", "slovu", "slov", "slovami"]) {
            expect(f.has(form), form).toBe(true)
        }
    })
})

describe("n-stems filed as soft stems", () => {
    it("decline as n-stems instead of getting a soft j", () => {
        // ime-NOUN in the dictionary: protoStemClass jo, stem "imen".
        const f = forms({ isv: "ime", pos: "NOUN", stem: "imen", protoStemClass: "jo", gender: "Neut" })
        for (const form of ["imę", "imene", "imeni", "imenem", "imena", "imenami"]) {
            expect(f.has(form), form).toBe(true)
        }
        expect(f.has("imenja")).toBe(false)
    })
})

describe("numerals 2-4", () => {
    it("recognise dvoh and dvoma", () => {
        const f = forms({ isv: "dva", pos: "NUM", stem: "dva" })
        expect(f.has("dvoh")).toBe(true)
        expect(f.has("dvoma")).toBe(true)
    })
})

describe("verb lexemes whose citation form is not an infinitive", () => {
    it("are left invariant instead of being cut into letter fragments", () => {
        // "je, jest" is a VERB lexeme holding forms of byti.
        expect([...forms({ isv: "je", pos: "VERB", stem: "je" })]).toEqual(["je"])
    })
})

describe("verbs with a prepositional tail", () => {
    it("conjugate the head taken from the stem", () => {
        const f = forms({
            isv: "zaviseti od", pos: "VERB", stem: "zavisěti od", secondaryStem: "zavisi", knownPrepositions: ["od"],
        })
        expect(f.has("zavisi od")).toBe(true)
        expect(f.has("zavisěl od")).toBe(true)
    })
})
