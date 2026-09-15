import { describe, it, expect } from "vitest"
import { classifyPronoun, generatePronounForms, canonicalPronounLemma, EnhancedPronounDbItem } from "./index"
import { Case, NumberType } from "../endingsRegistry"
import { AccentParadigm, GrammaticalGender } from "../common"

// Tone marks are combining characters appended to vowels; recognition strips them too.
const plain = (form: string) => form.replace(/[̀-̑]/g, "")

function forms(lemma: string, targetCase: Case, targetNumber: NumberType, targetGender = GrammaticalGender.MASC): string[] {
    const dbItem: EnhancedPronounDbItem = {
        interslavic: lemma,
        protoSlavic: lemma,
        paradigm: AccentParadigm.A,
        pronClass: classifyPronoun(lemma).pronClass,
    }
    return generatePronounForms({ dbItem, targetCase, targetNumber, targetGender }).map(plain)
}

const { SINGULAR, PLURAL } = NumberType
const { MASC, FEM, NEUT } = GrammaticalGender

describe("possessive and determiner pronouns decline like adjectives", () => {
    it("keeps the short masculine nominative and inflects the rest (soft)", () => {
        expect(forms("svoj", Case.NOMINATIVE, SINGULAR)).toEqual(["svoj"])
        expect(forms("svoj", Case.GENITIVE, SINGULAR)).toEqual(["svojego"])
        expect(forms("moj", Case.DATIVE, SINGULAR, FEM)).toEqual(["mojej"])
        expect(forms("moj", Case.NOMINATIVE, SINGULAR, FEM)).toEqual(["moja"])
        expect(forms("moj", Case.NOMINATIVE, SINGULAR, NEUT)).toEqual(["moje"])
        expect(forms("tvoj", Case.GENITIVE, PLURAL)).toEqual(["tvojih"])
        expect(forms("naš", Case.INSTRUMENTAL, SINGULAR)).toEqual(["našim"])
    })

    it("offers the genitive as the animate masculine accusative", () => {
        expect(forms("svoj", Case.ACCUSATIVE, SINGULAR)).toEqual(["svoj", "svojego"])
    })

    it("declines hard demonstratives on their bare stem", () => {
        expect(forms("tȯj", Case.NOMINATIVE, SINGULAR)).toEqual(["tȯj"])
        expect(forms("tȯj", Case.GENITIVE, SINGULAR)).toEqual(["togo"])
        expect(forms("tutȯj", Case.GENITIVE, SINGULAR)).toEqual(["tutogo"])
        expect(forms("tutȯj", Case.GENITIVE, PLURAL)).toEqual(["tutyh"])
        expect(forms("jedin", Case.GENITIVE, SINGULAR)).toEqual(["jednogo"])
        expect(forms("jedin", Case.LOCATIVE, SINGULAR, FEM)).toEqual(["jednoj"])
    })

    it("declines 'all' on the stem vs-", () => {
        expect(forms("vsi", Case.GENITIVE, PLURAL)).toEqual(["vsih"])
        expect(forms("vsi", Case.DATIVE, PLURAL)).toEqual(["vsim"])
        expect(forms("vėś", Case.GENITIVE, SINGULAR)).toEqual(["vsego"])
    })

    it("treats long -y pronouns as plain hard adjectives, particles included", () => {
        expect(forms("ktory", Case.NOMINATIVE, SINGULAR)).toEqual(["ktory"])
        expect(forms("kakykoli", Case.GENITIVE, SINGULAR)).toEqual(["kakogokoli"])
    })
})

describe("on", () => {
    it("adds the prepositional n- forms and the plural", () => {
        expect(forms("on", Case.GENITIVE, SINGULAR)).toEqual(["jego", "njego"])
        expect(forms("on", Case.DATIVE, SINGULAR, FEM)).toEqual(["jej", "njej"])
        expect(forms("on", Case.NOMINATIVE, PLURAL)).toEqual(["oni"])
        expect(forms("on", Case.GENITIVE, PLURAL)).toEqual(["jih", "njih"])
        expect(forms("on", Case.ACCUSATIVE, PLURAL)).toEqual(["jih", "je", "njih", "nje"])
    })
})

describe("kto/čto family", () => {
    it("declines prefixed forms and recognises čego alongside česo", () => {
        expect(forms("čto", Case.GENITIVE, SINGULAR)).toEqual(["česo", "čego"])
        expect(forms("ničto", Case.GENITIVE, SINGULAR)).toEqual(["ničeso", "ničego"])
        expect(forms("někto", Case.DATIVE, SINGULAR)).toEqual(["někomu"])
    })
})

describe("canonicalPronounLemma", () => {
    it("prefers the diacritic stem when it is the same word", () => {
        expect(canonicalPronounLemma("cto", "čto")).toBe("čto")
        expect(canonicalPronounLemma("tutoj", "tutȯj")).toBe("tutȯj")
        // a different word in the stem field is not a spelling of the value
        expect(canonicalPronounLemma("koj", "kojkoli")).toBe("koj")
    })
})
