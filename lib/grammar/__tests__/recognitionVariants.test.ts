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

describe("verbs with a reflexive tail", () => {
    it("also yield the forms without the separately written se", () => {
        const f = forms({ isv: "pojaviti se", pos: "VERB", stem: "pojavi", knownPrepositions: [] })
        for (const form of ["pojavil se", "pojavil", "pojavila", "pojaviti"]) {
            expect(f.has(form), form).toBe(true)
        }
    })
})

describe("short first person plural", () => {
    it("adds -m next to -mo, tagged both plural and singular", () => {
        const all = generateWordForms({ id: 1, slug: "test", flavor: "CORE", isv: "mogti", pos: "AUX", stem: "mogti" }, true)
        expect(all.some((f) => f.surfaceForm === "možemo")).toBe(true)
        expect(all.filter((f) => f.surfaceForm === "možem").map((f) => f.feats.number).sort()).toEqual(["pl", "sg"])
    })
})

describe("i-stem instrumental", () => {
    it("recognises -ju next to -ejų, with the soft consonant written plain", () => {
        expect(forms({ isv: "cest", pos: "NOUN", stem: "čęsť", protoStemClass: "i", gender: "Fem" }).has("čęstju")).toBe(true)
        expect(forms({ isv: "pomoc", pos: "NOUN", stem: "pomoć", protoStemClass: "i", gender: "Fem" }).has("pomočju")).toBe(true)
    })
})

describe("soft stems ending in c", () => {
    it("also take the hard endings writers use after c", () => {
        const f = forms({ isv: "kirilica", pos: "NOUN", stem: "kirilic", protoStemClass: "jā", gender: "Fem" })
        expect(f.has("kirilicy")).toBe(true)
        expect(f.has("kirilicę")).toBe(true)
    })
})

describe("adjectives with a stem in a palatal", () => {
    it("decline softly next to the hard forms, from the canonical stem", () => {
        const f = forms({ isv: "nasy", pos: "ADJ", stem: "naš" })
        for (const form of ["našy", "našego", "našej", "našem"]) {
            expect(f.has(form), form).toBe(true)
        }
    })
})

describe("u-stems", () => {
    it("also decline like o-stems", () => {
        const f = forms({ isv: "syn", pos: "NOUN", stem: "syn", protoStemClass: "u", gender: "Masc" })
        for (const form of ["syna", "synom", "synu"]) {
            expect(f.has(form), form).toBe(true)
        }
    })
})

describe("verb lexemes whose citation form is not an infinitive", () => {
    it("are left invariant instead of being cut into letter fragments", () => {
        // "je, jest" is a VERB lexeme holding forms of byti.
        expect([...forms({ isv: "je", pos: "VERB", stem: "je" })]).toEqual(["je"])
    })
})

describe("uninflected words whose value drops the diacritics", () => {
    it("take the canonical spelling from the stem, keeping the plain one as a variant", () => {
        const all = generateWordForms({ id: 1, slug: "treba-ADV", flavor: "CORE", isv: "treba", pos: "ADV", stem: "trěba" }, true)
        expect(all.find((f) => f.surfaceForm === "trěba")?.variant).toBeFalsy()
        expect(all.find((f) => f.surfaceForm === "treba")?.variant).toBe(true)
    })

    it("does the same for adpositions and conjunctions", () => {
        expect(forms({ isv: "velmi", pos: "ADV", stem: "veľmi" }).has("veľmi")).toBe(true)
        expect(forms({ isv: "ze", pos: "CCONJ", stem: "že" }).has("že")).toBe(true)
        expect(forms({ isv: "crez", pos: "ADP", stem: "črěz" }).has("črěz")).toBe(true)
    })

    it("keeps the value when the stem is not merely its diacritical twin", () => {
        expect([...forms({ isv: "no", pos: "CCONJ", stem: "no" })]).toEqual(["no"])
        // У наречия стем — база для степеней сравнения ("dobr"), не другое
        // написание: канон остаётся за value, степени строятся как прежде.
        const dobro = forms({ isv: "dobro", pos: "ADV", stem: "dobr" })
        expect(dobro.has("dobro")).toBe(true)
        expect(dobro.has("dobrěje")).toBe(true)
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
