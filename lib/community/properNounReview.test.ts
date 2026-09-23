import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { createDb } from "./testDb"
import { fetchProperNounQueue, countProperNounQueue, applyProperNounDecisions } from "./properNounReview"

function seed(db: Database.Database) {
    db.exec(`
        CREATE TABLE proper_noun_signals (lexemeId INTEGER PRIMARY KEY, refCapitalized INTEGER NOT NULL DEFAULT 0,
            corpusMidCap INTEGER NOT NULL DEFAULT 0, corpusMidTotal INTEGER NOT NULL DEFAULT 0, computedAt DATETIME DEFAULT CURRENT_TIMESTAMP);
        ALTER TABLE lexemes ADD COLUMN properNoun INTEGER;
        ALTER TABLE lexemes ADD COLUMN updatedAt DATETIME;
        INSERT INTO lexemes (id, slug, value, pos, isPublic, corpusFrequencyPerMln) VALUES (7, 'ufa-NOUN', 'ufa', 'NOUN', 1, 50);
        INSERT INTO meanings (id, lexemeId, meaning) VALUES (70, 7, 'city');
        INSERT INTO translations (id, language, value, verified, meaningId) VALUES
            (200, 'ru', 'Уфа', 0, 70), (201, 'de', 'Ufa', 0, 70), (202, 'en', 'Ufa, UFA', 1, 70);
        UPDATE translations SET value = 'Woda' WHERE id = 100;
        INSERT INTO proper_noun_signals (lexemeId, refCapitalized, corpusMidCap, corpusMidTotal) VALUES (7, 0, 34, 40), (1, 0, 0, 5);
    `)
}

describe("proper noun review queue", () => {
    let db: Database.Database
    beforeEach(() => { db = createDb(); seed(db) })

    it("lists candidates, suggested first, with only their capitalized translations outside de/nl/cu/eo", () => {
        expect(countProperNounQueue(db)).toEqual({ total: 2, suggested: 1 })
        const [ufa, voda] = fetchProperNounQueue(db, { limit: 10, offset: 0 })
        expect(ufa).toMatchObject({ lexemeId: 7, isv: "ufa", suggestedProper: true, corpusMidCap: 34 })
        expect(ufa.translations).toEqual([{ language: "en", value: "Ufa, UFA" }, { language: "ru", value: "Уфа" }])
        expect(voda).toMatchObject({ lexemeId: 1, isv: "voda", suggestedProper: false, translations: [{ language: "pl", value: "Woda" }] })
    })

    it("flags a proper noun and leaves its translations alone; lowercases a common one", () => {
        const result = applyProperNounDecisions(db, [{ lexemeId: 7, proper: true }, { lexemeId: 1, proper: false }], { id: "mod", email: "mod@example.com" })
        expect(result).toEqual({ flagged: 1, lowercased: 1 })
        expect(db.prepare(`SELECT properNoun FROM lexemes WHERE id = 7`).get()).toEqual({ properNoun: 1 })
        expect(db.prepare(`SELECT value FROM translations WHERE id = 200`).get()).toEqual({ value: "Уфа" })
        expect(db.prepare(`SELECT value FROM translations WHERE id = 100`).get()).toEqual({ value: "woda" })
        expect(countProperNounQueue(db)).toEqual({ total: 0, suggested: 0 })
        expect(db.prepare(`SELECT entityId, field, oldValue, newValue, userEmail FROM audit_logs ORDER BY id`).all()).toEqual([
            { entityId: 7, field: "properNoun", oldValue: "false", newValue: "true", userEmail: "mod@example.com" },
            { entityId: 1, field: "pl.value", oldValue: "Woda", newValue: "woda", userEmail: "mod@example.com" },
        ])
    })

    it("keeps abbreviations and skipped languages when lowercasing", () => {
        applyProperNounDecisions(db, [{ lexemeId: 7, proper: false }], { id: "mod", email: null })
        expect(db.prepare(`SELECT id, value FROM translations WHERE id IN (200, 201, 202) ORDER BY id`).all())
            .toEqual([{ id: 200, value: "уфа" }, { id: 201, value: "Ufa" }, { id: 202, value: "ufa, UFA" }])
        // ответы волонтёров по переводу не сброшены - смена регистра не новое значение
        expect(db.prepare(`SELECT communityStatus FROM translations WHERE id = 200`).get()).toEqual({ communityStatus: null })
    })
})
