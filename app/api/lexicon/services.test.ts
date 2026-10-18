import Database from "better-sqlite3";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const {initMock} = vi.hoisted(() => ({initMock: vi.fn()}));
vi.mock("@/lib/sqlite", () => ({init: initMock}));
import {getDictItems, getReverseDictItems} from "./services";

const connections: Database.Database[] = [];
function createDb() {
    const db = new Database(":memory:");
    connections.push(db);
    db.exec(`CREATE TABLE lexemes (
        id INTEGER PRIMARY KEY, value TEXT, slug TEXT, pos TEXT, mainCategory TEXT, usageType TEXT,
        isPublic INTEGER DEFAULT 1,
        ${'stem gender declension conjugation transcription aspect transitivity animacy degree pronType numType frequency intelligibility addition sameInLanguages etymology proto paradigm protoStemClass stemExtension genesis secondaryStem tertiaryStem hasAnomalies external_id'.split(' ').map(column => `${column} TEXT`).join(',')}
    );
    CREATE TABLE meanings (id INTEGER PRIMARY KEY, lexemeId INTEGER, meaning TEXT, examples TEXT, meaningVerified INTEGER);
    CREATE TABLE allophone_flavors (id INTEGER PRIMARY KEY, code TEXT);
    CREATE TABLE lexeme_allophones (id INTEGER PRIMARY KEY, lexemeId INTEGER, value TEXT, flavorId INTEGER, type TEXT, verified INTEGER);
    CREATE TABLE translations (id INTEGER PRIMARY KEY, meaningId INTEGER, language TEXT, value TEXT, verified INTEGER, message TEXT, legacyWordId INTEGER);
    CREATE VIRTUAL TABLE lexemes_text USING fts5(value, tokenize='trigram');
    CREATE VIRTUAL TABLE lexeme_allophones_text USING fts5(value, tokenize='trigram');
    INSERT INTO allophone_flavors VALUES (1, 'CORE'), (2, 'NSL');`);
    for (let id = 1; id <= 6; id++) {
        const value = id === 1 ? 'jez' : `jezero${id}`;
        db.prepare("INSERT INTO lexemes (id, value, slug, pos, mainCategory, usageType, isPublic) VALUES (?, ?, ?, 'NOUN', ?, ?, ?)")
            .run(id, value, `${value}-NOUN`, id <= 2 ? 'nature' : 'science', id === 2 ? 'technical' : 'general', id === 3 ? 0 : 1);
        db.prepare("INSERT INTO lexemes_text(rowid, value) VALUES (?, ?)").run(id, value);
        db.prepare("INSERT INTO lexeme_allophones(id, lexemeId, value, flavorId, type, verified) VALUES (?, ?, ?, 1, 'standard', ?)")
            .run(id, id, value, id <= 2 ? 1 : null);
        db.prepare("INSERT INTO lexeme_allophones_text(rowid, value) VALUES (?, ?)").run(id, value);
        db.prepare("INSERT INTO meanings VALUES (?, ?, ?, NULL, ?)").run(id * 10, id, `Meaning ${id}`, id <= 2 ? 1 : null);
        db.prepare("INSERT INTO translations(id, meaningId, language, value, verified) VALUES (?, ?, 'ru', 'озеро', ?)")
            .run(id, id * 10, id <= 2 ? 1 : null);
    }
    // Multiple meanings must be separate bounded rows, with no lost meanings
    // when the next page starts in the middle of a lexeme.
    db.exec(`INSERT INTO meanings VALUES (11, 1, 'Second meaning', NULL, 1), (12, 1, 'Third meaning', NULL, NULL);
      INSERT INTO translations(id, meaningId, language, value, verified) VALUES (11, 11, 'ru', 'вода', 1), (12, 12, 'ru', 'вода', 0);`);
    return db;
}
beforeEach(() => { initMock.mockReset(); initMock.mockImplementation(async () => createDb()); });
afterEach(() => { for (const db of connections.splice(0)) if (db.open) db.close(); });
const keys = (rows: Awaited<ReturnType<typeof getDictItems>>) => rows.map(row => [row.id, row.meaningId]);

describe("lexicon SQL pagination", () => {
    it.each(['', 'je', 'jez'])("bounds listing/LIKE/FTS search %j, in stable lexeme+meaning order", async search => {
        const first = await getDictItems(search, 0, 2);
        const second = await getDictItems(search, 2, 2);
        const rest = await getDictItems(search, 4, 2);
        expect(keys(first)).toEqual([[1, 10], [1, 11]]);
        expect(keys(second)).toEqual([[1, 12], [2, 20]]);
        expect(keys(rest)).toEqual([[4, 40], [5, 50]]);
        expect(first).toHaveLength(2);
        expect(first[0].ru).toEqual([expect.objectContaining({value: 'озеро', verified: 1})]);
        expect(first[0].word).toMatchObject({value: 'jez', flavorCode: 'CORE'});
        expect(connections.every(db => !db.open)).toBe(true);
    });
    it("caps the actual response at 100 rows even for one lexeme with many meanings", async () => {
        initMock.mockImplementation(async () => {
            const db = createDb();
            const insert = db.prepare("INSERT INTO meanings VALUES (?, 1, 'Extra meaning', NULL, 1)");
            for (let id = 100; id < 260; id++) insert.run(id);
            return db;
        });
        const first = await getDictItems('jez', 0, 100);
        const second = await getDictItems('jez', 100, 100);
        expect(first).toHaveLength(100);
        expect(second).toHaveLength(67);
        expect(new Set([...keys(first), ...keys(second)].map(key => key.join(':'))).size).toBe(167);
        expect(await getDictItems('jez', 167, 100)).toEqual([]);
    });
    it("ends with a partial page, then an empty array", async () => {
        expect(keys(await getDictItems('jez', 6, 2))).toEqual([[6, 60]]);
        expect(await getDictItems('jez', 7, 2)).toEqual([]);
    });
    it("filters category and usage before pagination in search", async () => {
        expect(keys(await getDictItems('jez', 0, 1, 'nature', 'technical'))).toEqual([[2, 20]]);
        expect(await getDictItems('jez', 1, 1, 'nature', 'technical')).toEqual([]);
    });
    it("paginates matching review rows, never drops matches after LIMIT", async () => {
        expect(keys(await getDictItems('jez', 0, 2, '', '', 'ru', true))).toEqual([[1, 12], [4, 40]]);
        expect(keys(await getDictItems('jez', 2, 2, '', '', 'ru', true))).toEqual([[5, 50], [6, 60]]);
        expect(keys(await getDictItems('', 0, 2, '', '', '', false, false, true))).toEqual([[1, 12], [4, 40]]);
        expect(keys(await getDictItems('jez', 0, 2, '', '', '', false, false, false, true))).toEqual([[4, 40], [5, 50]]);
    });
    it("includes hidden words only for an authorized caller", async () => {
        const rows = await getDictItems('jez', 0, 100, '', '', '', false, true);
        expect(rows.some(row => row.id === 3)).toBe(true);
        expect((await getDictItems('jez', 0, 100)).some(row => row.id === 3)).toBe(false);
    });
    it("keeps lexemes without meanings as one row", async () => {
        initMock.mockImplementation(async () => { const db = createDb(); db.exec('DELETE FROM meanings WHERE lexemeId = 6'); return db; });
        expect(keys(await getDictItems('', 6, 2))).toEqual([[6, null]]);
    });
    it("combines canonical allophone and folded spelling matches without duplicate rows", async () => {
        initMock.mockImplementation(async () => {
            const db = createDb();
            db.exec("UPDATE lexeme_allophones SET value = 'język' WHERE id = 1; UPDATE lexeme_allophones_text SET value = 'język' WHERE rowid = 1; UPDATE lexemes SET value = 'jezyk' WHERE id = 1; UPDATE lexemes_text SET value = 'jezyk' WHERE rowid = 1");
            return db;
        });
        expect(keys(await getDictItems('język', 0, 2))).toEqual([[1, 10], [1, 11]]);
        expect(keys(await getDictItems('język', 2, 2))).toEqual([[1, 12]]);
    });
    it("treats LIKE wildcards and backslashes literally", async () => {
        expect(await getDictItems('%', 0, 10)).toEqual([]);
        expect(await getDictItems('_', 0, 10)).toEqual([]);
        expect(await getDictItems('\\', 0, 10)).toEqual([]);
        expect(await getReverseDictItems('%', 'ru', 0, 10)).toEqual([]);
    });
    it("paginates reverse search with the same row limit", async () => {
        expect(keys(await getReverseDictItems('озеро', 'ru', 0, 2))).toEqual([[1, 10], [1, 11]]);
        expect(keys(await getReverseDictItems('озеро', 'ru', 2, 2))).toEqual([[1, 12], [2, 20]]);
        expect((await getReverseDictItems('озеро', 'ru', 0, 100)).some(row => row.id === 3)).toBe(false);
        expect((await getReverseDictItems('озеро', 'ru', 0, 100, true)).some(row => row.id === 3)).toBe(true);
    });
    it("does not open a connection for invalid direct calls or empty reverse search", async () => {
        await expect(getDictItems('', 0, -1)).rejects.toThrow();
        await expect(getDictItems('jez', -1, 50)).rejects.toThrow();
        await expect(getReverseDictItems('озеро', 'ru', 0, 101)).rejects.toThrow();
        expect(await getReverseDictItems('', 'ru', 0, 50)).toEqual([]);
        expect(initMock).not.toHaveBeenCalled();
    });
    it("closes the connection on SQL failure", async () => {
        initMock.mockImplementation(async () => { const db = createDb(); db.exec('DROP TABLE meanings'); return db; });
        await expect(getDictItems('jez', 0, 10)).rejects.toThrow();
        expect(connections.every(db => !db.open)).toBe(true);
    });
});
