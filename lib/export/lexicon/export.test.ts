import Database from "better-sqlite3"
import Papa from "papaparse"
import { describe, expect, it } from "vitest"
import { streamLexiconCsv } from "./csv"
import { buildStardict } from "./stardict"

function fixture() {
    const db = new Database(":memory:")
    db.exec(`
        CREATE TABLE lexemes (id INTEGER PRIMARY KEY, slug TEXT, value TEXT, pos TEXT, isPublic INTEGER);
        CREATE TABLE allophone_flavors (id INTEGER PRIMARY KEY, code TEXT);
        CREATE TABLE lexeme_allophones (id INTEGER PRIMARY KEY, lexemeId INTEGER, flavorId INTEGER, type TEXT, value TEXT);
        CREATE TABLE meanings (id INTEGER PRIMARY KEY, lexemeId INTEGER, meaning TEXT);
        CREATE TABLE translations (id INTEGER PRIMARY KEY, meaningId INTEGER, language TEXT, value TEXT, verified INTEGER);
        INSERT INTO lexemes VALUES (1, 'key', 'kluc', 'NOUN', 1), (2, 'private', 'private', 'NOUN', 0), (3, 'new', 'novo', 'NOUN', 1);
        INSERT INTO allophone_flavors VALUES (1, 'CORE'), (2, 'NSL');
        INSERT INTO lexeme_allophones VALUES (1, 1, 1, 'standard', 'ključ'), (2, 1, 2, 'standard', 'wrong');
        INSERT INTO meanings VALUES (1, 1, 'Lock'), (2, 1, 'Spring, "water"'), (3, 2, 'private');
        INSERT INTO translations VALUES
            (1, 1, 'ru', 'ключ', 1), (2, 1, 'ru', 'отмычка', 0),
            (3, 2, 'pl', 'źródło', 1), (4, 2, 'en', '=1+1', 0),
            (5, 3, 'en', 'secret', 1);
    `)
    return db
}

describe("public lexicon CSV", () => {
    it("keeps meanings and variants distinct, escapes CSV and spreadsheet formulas, and excludes hidden words", async () => {
        const db = fixture()
        const csv = await new Response(streamLexiconCsv(db)).text()
        const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true })
        expect(parsed.errors).toEqual([])
        expect(parsed.data.slice(1)).toEqual([
            ["key", "kluc", "ključ", "NOUN", "1", "Lock", "ru", "ключ", "1"],
            ["key", "kluc", "ključ", "NOUN", "1", "Lock", "ru", "отмычка", "0"],
            ["key", "kluc", "ključ", "NOUN", "2", 'Spring, "water"', "pl", "źródło", "1"],
            ["key", "kluc", "ključ", "NOUN", "2", 'Spring, "water"', "en", "'=1+1", "0"],
            ["new", "novo", "", "NOUN", "", "", "", "", ""],
        ])
        expect(db.open).toBe(false)
    })

    it("closes a cancelled download", async () => {
        const db = fixture()
        const stream = streamLexiconCsv(db)
        await stream.cancel()
        expect(db.open).toBe(false)
    })
})

function records(buffer: Buffer, fields: number) {
    const entries: { word: string; values: number[] }[] = []
    for (let cursor = 0; cursor < buffer.length;) {
        const end = buffer.indexOf(0, cursor)
        const values = Array.from({ length: fields }, (_, i) => buffer.readUInt32BE(end + 1 + 4 * i))
        entries.push({ word: buffer.toString("utf8", cursor, end), values })
        cursor = end + 1 + 4 * fields
    }
    return entries
}

describe("public lexicon StarDict", () => {
    it("sorts UTF-8 keys by StarDict rules and indexes homographs, senses and aliases by byte offset", async () => {
        const db = fixture()
        db.exec(`
            INSERT INTO lexemes VALUES (4, 'other-key', 'kluč', 'VERB', 1),
                (5, 'capital', 'Novo', 'ADJ', 1), (6, 'non-ascii', 'Život', 'NOUN', 1),
                (7, 'five', 'pet', 'NUM', 1);
            INSERT INTO lexeme_allophones VALUES (3, 4, 1, 'standard', 'ključ');
            INSERT INTO lexeme_allophones VALUES (4, 7, 1, 'standard', 'pęť');
            INSERT INTO translations VALUES (6, 1, 'ru', 'ключ', 1);
        `)
        try {
            const zip = await buildStardict(db)
            const indexData = zip.readFile("interlex.idx")!
            const index = records(indexData, 2)
            expect(index.map(({ word }) => word)).toEqual(["ključ", "ključ", "Novo", "novo", "pęť", "Život"])
            const aliases = records(zip.readFile("interlex.syn")!, 1)
            expect(aliases).toEqual(expect.arrayContaining([
                { word: "pet", values: [4] },
                { word: "кључ", values: [0] },
                { word: "кључ", values: [1] },
            ]))
            expect(aliases.map(({ word }) => word)).not.toContain("kluc")
            expect(zip.readAsText("interlex.ifo")).toBe([
                "StarDict's dict ifo file", "version=2.4.2", "bookname=Interslavic Lexicon", "wordcount=6",
                `idxfilesize=${indexData.length}`, `synwordcount=${aliases.length}`, "sametypesequence=m", "",
            ].join("\n"))
            const dictionary = zip.readFile("interlex.dict")!
            const contents = index.map(({ values: [start, size] }) => dictionary.toString("utf8", start, start + size))
            expect(contents).toEqual([
                'NOUN\n\n1. Lock\nru: ключ; отмычка\n\n2. Spring, "water"\npl: źródło\nen: =1+1',
                "VERB", "ADJ", "NOUN", "NUM", "NOUN",
            ])
            expect(dictionary.toString("utf8")).not.toContain("secret")
        } finally {
            db.close()
        }
    })
})
