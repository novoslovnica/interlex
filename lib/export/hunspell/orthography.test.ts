import { describe, expect, it } from "vitest"
import { cyrillicSpellings, latinSpellings, toStandardLatin } from "./orthography"

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
        expect(cyrillicSpellings("člověk")).toEqual(expect.arrayContaining(["чловєк", "чловек"]))
        expect(cyrillicSpellings("konj")).toEqual(expect.arrayContaining(["коњ", "конј"]))
    })
    it("keeps a leading capital", () => {
        expect(cyrillicSpellings("Moskva")[0]).toBe("Москва")
    })
})
