import Database from "better-sqlite3"
import { beforeEach, describe, expect, it } from "vitest"
import { lookupInDb, resetLookupIndex, splitMeaning, type FormAnalyzer } from "./lookup"
import { pickIndex, wordOfDayId } from "./wordOfDay"
import { lookupMessage, paradigmMessage } from "./compose"
import { formatTable, toDiscordEmbed, toTelegramHtml } from "./message"
import { toBotLocale, translationLanguages } from "./labels"

function dictionary() {
    const db = new Database(":memory:")
    db.exec(`
        CREATE TABLE lexemes (id INTEGER PRIMARY KEY, slug TEXT, value TEXT, stem TEXT, pos TEXT, gender TEXT, aspect TEXT, isPublic INTEGER DEFAULT 1, cefrLevel TEXT);
        CREATE VIRTUAL TABLE lexemes_text USING fts5(value, tokenize = 'trigram');
        CREATE TABLE meanings (id INTEGER PRIMARY KEY, lexemeId INTEGER, meaning TEXT);
        CREATE TABLE translations (id INTEGER PRIMARY KEY, meaningId INTEGER, language TEXT, value TEXT, verified INTEGER);
    `)
    const words: [number, string, string, string | null][] = [
        [1, "voda-NOUN", "voda", "Fem"], [2, "vodka-NOUN", "vodka", "Fem"], [3, "člověk-NOUN", "člověk", "Masc"],
        [4, "pisati-VERB", "pisati", null], [5, "tajny-ADJ", "tajny", null],
    ]
    for (const [id, slug, value, gender] of words) {
        db.prepare(`INSERT INTO lexemes (id, slug, value, pos, gender, cefrLevel) VALUES (?, ?, ?, ?, ?, ?)`).run(id, slug, value, slug.split("-")[1], gender, id === 5 ? "C2" : "A1")
        db.prepare(`INSERT INTO lexemes_text (rowid, value) VALUES (?, ?)`).run(id, value)
        db.prepare(`INSERT INTO meanings (id, lexemeId, meaning) VALUES (?, ?, ?)`).run(id * 10, id, id === 1 ? "Prozračna židkost" : null)
    }
    const tr = db.prepare(`INSERT INTO translations (meaningId, language, value, verified) VALUES (?, ?, ?, ?)`)
    tr.run(10, "ru", "вода", 1); tr.run(10, "en", "water", 1); tr.run(20, "en", "vodka", 1); tr.run(30, "en", "man, human", 1)
    tr.run(40, "en", "to write", 0); tr.run(50, "en", "secret", 1)
    return db
}

const noAnalyzer = null
const fakeAnalyzer: FormAnalyzer = {
    async analyzeWord(form) {
        return form === "vodu" ? { wordSlug: "voda-NOUN", feats: { case: "acc", number: "sg" }, candidates: [{ wordSlug: "voda-NOUN" }] } : null
    },
}

describe("lookupInDb", () => {
    beforeEach(() => resetLookupIndex())
    it("finds the exact word with translations in the requested languages, verified first", async () => {
        const r = await lookupInDb(dictionary(), "voda", ["ru", "en"], noAnalyzer)
        expect(r.via).toBe("exact")
        expect(r.entries[0]).toMatchObject({ value: "voda", translations: [{ language: "ru", values: ["вода"] }, { language: "en", values: ["water"] }], meanings: ["Prozračna židkost"] })
    })
    it("splits a stored meaning into definition and example", () => {
        expect(splitMeaning("člověk;ziva razumna bytosť;*Tuten stary **člověk** proživel.*", "člověk")).toEqual({ definition: "ziva razumna bytosť", example: "Tuten stary člověk proživel." })
        expect(splitMeaning("Tečna čista židkostj;voda.;*Pio **vodu**.*", "voda")).toEqual({ definition: "Tečna čista židkostj", example: "Pio vodu." })
    })
    it("accepts Cyrillic and a simplified spelling", async () => {
        expect((await lookupInDb(dictionary(), "вода", ["en"], noAnalyzer)).entries[0].value).toBe("voda")
        expect((await lookupInDb(dictionary(), "človek", ["en"], noAnalyzer)).entries[0].value).toBe("člověk")
        expect((await lookupInDb(dictionary(), "чловєк", ["en"], noAnalyzer)).entries[0].value).toBe("člověk")
    })
    it("resolves an inflected form through the analyzer", async () => {
        const r = await lookupInDb(dictionary(), "vodu", ["en"], fakeAnalyzer)
        expect(r.via).toBe("form")
        expect(r.formReadings).toEqual(["acc sg"])
        expect(r.entries[0].value).toBe("voda")
    })
    it("offers similar words for a typo, and nothing for garbage", async () => {
        const typo = await lookupInDb(dictionary(), "pisatu", ["en"], noAnalyzer)
        expect(typo.via).toBe("fuzzy")
        expect(typo.entries.map((e) => e.value)).toContain("pisati")
        expect((await lookupInDb(dictionary(), "qwxz", ["en"], noAnalyzer)).via).toBe("none")
    })
    it("hides non-public lexemes", async () => {
        const db = dictionary()
        db.prepare(`UPDATE lexemes SET isPublic = 0 WHERE id = 1`).run()
        expect((await lookupInDb(db, "voda", ["en"], noAnalyzer)).entries.map((e) => e.value)).not.toContain("voda")
    })
})

describe("word of the day", () => {
    it("is stable within a day and spread across days", () => {
        expect(pickIndex("2026-09-24", 5933)).toBe(pickIndex("2026-09-24", 5933))
        const days = new Set(Array.from({ length: 30 }, (_, i) => pickIndex(`2026-10-${String(i + 1).padStart(2, "0")}`, 5933)))
        expect(days.size).toBeGreaterThan(25)
    })
    it("only picks A1-B2 content words with a verified en/ru translation", () => {
        const db = dictionary()
        // tajny - C2, pisati - перевод не проверен: в пул не попадают.
        const picked = new Set(Array.from({ length: 40 }, (_, i) => wordOfDayId(db, new Date(Date.UTC(2026, 0, i + 1)))))
        expect([...picked].every((id) => id === 1 || id === 2 || id === 3)).toBe(true)
    })
})

describe("compose and render", () => {
    beforeEach(() => resetLookupIndex())
    it("renders a lookup card for Telegram without unescaped HTML", async () => {
        const r = await lookupInDb(dictionary(), "voda", ["ru", "en"], noAnalyzer)
        const html = toTelegramHtml(lookupMessage(r, "ru", "lat"))
        expect(html).toContain("<b>voda</b>")
        expect(html).toContain("вода")
        expect(html).toContain('href="https://')
        expect(toTelegramHtml({ title: "<x>", lines: ["a & b"] })).toBe("<b>&lt;x&gt;</b>\n\na &amp; b")
        expect(toTelegramHtml({ title: "", lines: ["только текст"] })).toBe("только текст")
    })
    it("shows the card in Cyrillic when the query was Cyrillic", async () => {
        const r = await lookupInDb(dictionary(), "чловєк", ["en"], noAnalyzer)
        expect(lookupMessage(r, "en", "cyr").title).toBe("чловєк")
    })
    it("builds a noun table and a Discord embed", () => {
        const msg = paradigmMessage({ id: 1, pos: "NOUN", value: "voda", stem: "vod", paradigm: "A", gender: "Fem", protoStemClass: "ā" }, [], "en", "lat")
        expect(msg.table?.[0]).toEqual(["", "sg", "pl"])
        expect(msg.table?.[2]).toEqual(["Gen", "vody", "vod"])
        const embed = toDiscordEmbed(msg)
        expect(embed.description).toContain("```")
        expect(embed.url).toMatch(/\/words\/1$/)
    })
    it("aligns table columns", () => {
        expect(formatTable([["a", "bb"], ["ccc", "d"]])).toBe("a    bb\nccc  d")
    })
})

describe("labels", () => {
    it("maps platform languages", () => {
        expect(toBotLocale("ru")).toBe("ru")
        expect(toBotLocale("uk-UA")).toBe("ru")
        expect(toBotLocale("pl")).toBe("en")
        expect(translationLanguages("pl", ["en", "ru", "pl"])).toEqual(["pl", "en"])
        expect(translationLanguages("fr", ["en", "ru"])).toEqual(["en", "ru"])
    })
})
