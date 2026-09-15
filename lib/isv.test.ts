import { describe, it, expect } from "vitest"
import { isvToCyr, isvToGlagolitic, standardToSimple, standardToSimpleCyr } from "./isv"
import { etymCyrToEtymLat } from "./transliteration"

describe("isvToCyr: extended Latin letters", () => {
    it("writes syllabic ŕ/ĺ and soft ń with a soft sign, like ľ/ť", () => {
        expect(isvToCyr("podvŕgnųti")).toBe("подврьгнѫти")
        expect(isvToCyr("aktoŕsky")).toBe("акторьскы")
        expect(isvToCyr("afgańsky")).toBe("афганьскы")
        expect(isvToCyr("vĺna")).toBe("вльна")
    })

    it("writes strong jers as jers and long å as а with a ring", () => {
        expect(isvToCyr("afrikanėc")).toBe("африканьц")
        expect(isvToCyr("jablȯko")).toBe("іаблъко")
        expect(isvToCyr("glåvnopošta")).toBe("гла̊внопоща")
    })

    it("keeps a stress mark but transliterates the letter under it", () => {
        expect(isvToCyr("móre")).toBe("мо́ре")
        expect(isvToCyr("tògda")).toBe("то̀гда")
    })

    it("leaves no Latin letters in etymological words", () => {
        for (const word of ["podvŕgnųti", "glåvnopošta", "sȯn", "dėn", "końa", "prěhlåđeny", "smŕť"]) {
            expect(isvToCyr(word)).not.toMatch(/\p{Script=Latin}/u)
        }
    })
})

describe("isvToGlagolitic: extended Latin letters", () => {
    it("covers č/š, soft consonants and jers", () => {
        expect(isvToGlagolitic("čaša")).toBe("ⱍⰰⱎⰰ")
        expect(isvToGlagolitic("podvŕgnųti")).toBe("ⱂⱁⰴⰲⱃⱐⰳⱀⱘⱅⰹ")
        expect(isvToGlagolitic("sȯn")).toBe("ⱄⱏⱀ")
    })

    it("leaves no Latin letters in etymological words", () => {
        for (const word of ["podvŕgnųti", "glåvnopošta", "dėn", "noć", "veľmi", "smŕť", "móre"]) {
            expect(isvToGlagolitic(word)).not.toMatch(/\p{Script=Latin}/u)
        }
    })
})

describe("simple spelling", () => {
    it("drops the length and jer marks", () => {
        expect(standardToSimple("glåvnopošta")).toBe("glavnopošta")
        expect(standardToSimple("podvŕgnųti")).toBe("podvrgnuti")
        expect(standardToSimpleCyr("podvŕgnųti")).toBe("подвргнути")
        expect(standardToSimpleCyr("sȯn")).toBe("сон")
    })
})

describe("etymCyrToEtymLat: standard Cyrillic letters", () => {
    it("reads ј/љ/њ/ћ/ђ", () => {
        expect(etymCyrToEtymLat("је")).toBe("je")
        expect(etymCyrToEtymLat("људи")).toBe("ljudi")
        expect(etymCyrToEtymLat("моћ")).toBe("moć")
        // mixed script: Cyrillic ј inside an otherwise Latin word
        expect(etymCyrToEtymLat("јest")).toBe("jest")
    })
})
