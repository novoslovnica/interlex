import { describe, expect, it } from "vitest"
import { buildAdjectiveColumns, buildNounParadigm, buildVerbParadigm } from "./paradigm"
import { GrammaticalGender } from "@/lib/grammar/common/gender"
import { Case, NumberType } from "@/lib/grammar/endingsRegistry"

// Поля - как в живой interlex.db (2026-09-24). Формы проверяются без ударений:
// тесты про то, что парадигма собирается и совпадает для сайта и ботов, а не
// про акцентологию.
const plain = (s: string) => s.normalize("NFD").replace(/[̀́̂̑̏]/g, "").normalize("NFC")

describe("buildNounParadigm", () => {
    it("declines voda", () => {
        const p = buildNounParadigm({ pos: "NOUN", value: "voda", stem: "vod", paradigm: "A", gender: "Fem", protoStemClass: "ā" })!
        expect(plain(p.singular.nom)).toBe("voda")
        expect(plain(p.singular.gen)).toBe("vody")
        expect(plain(p.singular.acc)).toBe("vodų")
        expect(plain(p.plural.dat)).toBe("vodam")
    })
    it("declines konj (soft animate masculine)", () => {
        const p = buildNounParadigm({ pos: "NOUN", value: "konj", stem: "kon", paradigm: "A", gender: "Masc", animacy: "Anim", protoStemClass: "jo" })!
        expect(plain(p.singular.gen)).toBe("konja")
        expect(plain(p.singular.acc)).toBe("konja")
    })
    it("returns null for other parts of speech and collocations", () => {
        expect(buildNounParadigm({ pos: "VERB", value: "pisati" })).toBeNull()
        expect(buildNounParadigm({ pos: "NOUN", value: "želězna doroga", isCollocation: true })).toBeNull()
    })
})

describe("buildVerbParadigm", () => {
    it("conjugates pisati with its present stem", () => {
        const v = buildVerbParadigm({ pos: "VERB", value: "pisati", stem: "pisa", secondaryStem: "piše", aspect: "IPF" }, [])!
        expect(plain(v.infinitive)).toBe("pisati")
        expect(plain(v.indicative.presentOrFutureDirect["3sg"])).toBe("piše")
        expect(plain(v.lParticiple.masculine)).toBe("pisal")
    })
    it("keeps the preposition tail on every form", () => {
        const v = buildVerbParadigm({ pos: "VERB", value: "zaviseti od", stem: "zavisěti od", secondaryStem: "zavisi", aspect: "IPF" }, ["od"])!
        expect(plain(v.indicative.presentOrFutureDirect["3sg"])).toBe("zavisi od")
    })
})

describe("buildAdjectiveColumns", () => {
    it("declines dobry for each gender", () => {
        const masc = buildAdjectiveColumns({ value: "dobry" }, GrammaticalGender.MASC, "pos")
        const fem = buildAdjectiveColumns({ value: "dobry" }, GrammaticalGender.FEM, "pos")
        expect(plain(masc[NumberType.SINGULAR][Case.GENITIVE])).toBe("dobrogo")
        expect(plain(fem[NumberType.SINGULAR][Case.NOMINATIVE])).toBe("dobra")
    })
})
