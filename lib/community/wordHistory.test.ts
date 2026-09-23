import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { createDb } from "./testDb"
import { fetchWordHistory, countWordHistory, classifyAuthor, isPublicHistoryField } from "./wordHistory"

describe("word history", () => {
    let db: Database.Database
    beforeEach(() => {
        db = createDb()
        const insert = db.prepare(`INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt) VALUES (?, 'Lexeme', 1, ?, ?, ?, ?, ?, ?)`)
        insert.run("a1", "pl.value", "Woda", "woda", null, "script:normalize-capitalization", "2026-09-19 10:00:00")
        insert.run("a2", "ru.value", "вада", "вода", "mod1", "mod@example.com", "2026-09-20 10:00:00")
        insert.run("a2", "ru.message", null, "опечатка", "mod1", "mod@example.com", "2026-09-20 10:00:00")
        insert.run("a2", "ru.verified", "0", "1", "mod1", "mod@example.com", "2026-09-20 10:00:00")
        insert.run("a3", "corpusFrequencyPerMln", "1", "2", null, "script:frequency", "2026-09-21 10:00:00")
        insert.run("a4", "pl.communityStatus", null, "confirmed", null, "community", "2026-09-22 10:00:00")
        insert.run("b1", "value", "x", "y", "mod1", "mod@example.com", "2026-09-23 10:00:00") // другая лексема
        db.prepare(`UPDATE audit_logs SET entityId = 2 WHERE actionId = 'b1'`).run()
    })

    it("groups by action, newest first, hides service fields and whole service-only actions", () => {
        expect(countWordHistory(db, 1)).toBe(3)
        const history = fetchWordHistory(db, 1, { limit: 10, offset: 0 })
        expect(history.map((a) => a.actionId)).toEqual(["a4", "a2", "a1"])
        expect(history[1]).toMatchObject({ authorKind: "moderator", userId: "mod1", changes: [{ field: "ru.value", oldValue: "вада", newValue: "вода" }] })
        expect(history[0]).toMatchObject({ authorKind: "community", userId: null })
        expect(history[2]).toMatchObject({ authorKind: "script" })
        expect(JSON.stringify(history)).not.toContain("example.com")
    })

    it("paginates by action", () => {
        expect(fetchWordHistory(db, 1, { limit: 1, offset: 1 }).map((a) => a.actionId)).toEqual(["a2"])
        expect(fetchWordHistory(db, 1, { limit: 5, offset: 3 })).toEqual([])
    })

    it("classifies authors and fields", () => {
        expect(classifyAuthor("community", null)).toBe("community")
        expect(classifyAuthor("script:x", null)).toBe("script")
        expect(classifyAuthor("unknown", null)).toBe("moderator")
        expect(classifyAuthor("script:x", "u1")).toBe("moderator")
        expect(isPublicHistoryField("hsb.value")).toBe(true)
        expect(isPublicHistoryField("hsb.message")).toBe(false)
        expect(isPublicHistoryField("valencyArgument:5.preposition")).toBe(false)
    })
})
