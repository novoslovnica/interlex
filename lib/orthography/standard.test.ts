import { describe, expect, it } from "vitest"
import { cyrillicSpellings, cyrillicToLatin, isCyrillicText, latinSpellings, latinToCyrillic, toStandardLatin } from "./standard"

describe("toStandardLatin", () => {
    it.each([
        ["język", "jezyk"], ["sųt", "sut"], ["dėnj", "denj"], ["prijateľ", "prijatelj"], ["stolěťa", "stolětja"],
        ["međuslovjansky", "medžuslovjansky"], ["noć", "noč"], ["vŕh", "vrh"], ["åzbuka", "azbuka"], ["vȯda", "voda"],
        ["člověk", "člověk"], ["dobrojų", "dobroju"], ["tògda", "togda"],
        ["međuslovjańsky", "medžuslovjansky"], ["koń", "konj"], ["pęť", "pet"], ["moŕa", "morja"], ["kosť", "kost"],
    ])("%s -> %s", (etym, std) => expect(toStandardLatin(etym)).toBe(std))
})

describe("latinSpellings", () => {
    it("standard first, then accepted variants", () => {
        const s = latinSpellings("člověk")
        expect(s[0]).toBe("člověk")
        expect(s).toContain("človek")
    })
    it("accepts optional ć/đ and i for y", () => {
        expect(latinSpellings("međuslovjansky")).toEqual(expect.arrayContaining(["medžuslovjansky", "međuslovjansky", "medžuslovjanski"]))
        expect(latinSpellings("noć")).toEqual(expect.arrayContaining(["noč", "noć"]))
    })
    it("drops what is not a plain word", () => {
        expect(latinSpellings("sę li")).toEqual([])
    })
})

describe("cyrillicSpellings", () => {
    it("uses the standard Cyrillic with ј, љ, њ, дж, є, ы", () => {
        expect(cyrillicSpellings("język")[0]).toBe("језык")
        expect(cyrillicSpellings("sųt")[0]).toBe("сут")
        expect(cyrillicSpellings("međuslovjansky")[0]).toBe("меджусловјанскы")
        expect(cyrillicSpellings("prijateľ")[0]).toBe("пријатељ")
        expect(cyrillicSpellings("člověk")[0]).toBe("чловєк")
        expect(cyrillicSpellings("člověk")).toEqual(expect.arrayContaining(["чловєк", "чловѣк", "чловек"]))
        expect(cyrillicSpellings("konj")).toEqual(expect.arrayContaining(["коњ", "конј"]))
    })
    it("keeps a leading capital", () => {
        expect(cyrillicSpellings("Moskva")[0]).toBe("Москва")
    })
})

describe("text transliteration", () => {
    it("Latin -> Cyrillic keeps punctuation and case", () => {
        expect(latinToCyrillic("Ja govorju medžuslovjansky, člověk!")).toBe("Ја говорју меджусловјанскы, чловєк!")
        expect(latinToCyrillic("język sųt")).toBe("језык сут")
    })
    it("Cyrillic -> Latin, standard and etymological", () => {
        expect(cyrillicToLatin("Меджусловјанскы језык")).toBe("Medžuslovjansky jezyk")
        expect(cyrillicToLatin("чловѣк пријатељ")).toBe("člověk prijatelj")
    })
    it("detects the script by majority", () => {
        expect(isCyrillicText("језык")).toBe(true)
        expect(isCyrillicText("jezyk")).toBe(false)
    })
})
