import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { createDb } from "./testDb"
import { evaluateConsensus } from "./consensus"
import { selectNextCard, castVote } from "./translationCards"
import { upsertTranslation } from "@/lib/translations"

describe("evaluateConsensus", () => {
    it("needs a margin of 3, not just 3 yes answers", () => {
        expect(evaluateConsensus({ yes: 2, no: 0, decisive: 2 })).toBeNull()
        expect(evaluateConsensus({ yes: 3, no: 0, decisive: 3 })).toBe("confirmed")
        expect(evaluateConsensus({ yes: 3, no: 1, decisive: 4 })).toBeNull()
        expect(evaluateConsensus({ yes: 4, no: 1, decisive: 5 })).toBe("confirmed")
        expect(evaluateConsensus({ yes: 0, no: 3, decisive: 3 })).toBe("rejected")
    })

    it("gives up as disputed after 7 decisive answers without a margin", () => {
        expect(evaluateConsensus({ yes: 3, no: 3, decisive: 6 })).toBeNull()
        expect(evaluateConsensus({ yes: 4, no: 3, decisive: 7 })).toBe("disputed")
    })

    it("counts weights, so one trusted voter can outweigh", () => {
        expect(evaluateConsensus({ yes: 4, no: 0.25, decisive: 3 })).toBe("confirmed")
    })
})

describe("selectNextCard", () => {
    let db: Database.Database
    beforeEach(() => { db = createDb() })

    it("offers only open, non-empty, public, POS-tagged translations of the language", () => {
        const seen = new Set<number>()
        for (let i = 0; i < 50; i++) {
            const card = selectNextCard(db, { userId: "u1", language: "pl", random: () => i / 50 })
            if (card) seen.add(card.translationId)
        }
        expect([...seen].sort()).toEqual([100, 101])
    })

    it("fills the card with the CORE spelling and ru/en context", () => {
        const card = selectNextCard(db, { userId: "u1", language: "pl", random: () => 0 })
        expect(card).toMatchObject({ translationId: 100, isv: "voda", value: "woda", context: { ru: "вода", en: "water" } })
    })

    it("does not hint the language being checked", () => {
        const card = selectNextCard(db, { userId: "u1", language: "en", random: () => 0 })
        expect(card?.context).toEqual({ ru: "вода", en: null })
    })

    it("skips what the user already answered and prefers cards already started by others", () => {
        castVote(db, { userId: "other", translationId: 101, language: "pl", verdict: "yes" })
        // 101 менее частотна, но уже начата - идёт первой при любом random
        expect(selectNextCard(db, { userId: "u1", language: "pl", random: () => 0.99 })?.translationId).toBe(101)
        castVote(db, { userId: "u1", translationId: 101, language: "pl", verdict: "yes" })
        expect(selectNextCard(db, { userId: "u1", language: "pl", random: () => 0 })?.translationId).toBe(100)
        castVote(db, { userId: "u1", translationId: 100, language: "pl", verdict: "unknown" })
        expect(selectNextCard(db, { userId: "u1", language: "pl" })).toBeNull()
    })
})

describe("castVote", () => {
    let db: Database.Database
    beforeEach(() => { db = createDb() })

    const status = (id: number) => db.prepare(`SELECT communityStatus s, communityYes y, communityNo n, verified v FROM translations WHERE id = ?`).get(id)

    it("confirms after three agreeing answers, never touches verified, logs once as community", () => {
        expect(castVote(db, { userId: "a", translationId: 100, language: "pl", verdict: "yes" })).toEqual({ ok: true, status: null })
        castVote(db, { userId: "b", translationId: 100, language: "pl", verdict: "unknown" })
        castVote(db, { userId: "c", translationId: 100, language: "pl", verdict: "yes" })
        expect(status(100)).toEqual({ s: null, y: 2, n: 0, v: 0 })
        expect(castVote(db, { userId: "d", translationId: 100, language: "pl", verdict: "yes" })).toEqual({ ok: true, status: "confirmed" })
        expect(status(100)).toEqual({ s: "confirmed", y: 3, n: 0, v: 0 })

        const logs = db.prepare(`SELECT entityType, entityId, field, newValue, userId, userEmail FROM audit_logs`).all()
        expect(logs).toEqual([{ entityType: "Lexeme", entityId: 1, field: "pl.communityStatus", newValue: "confirmed", userId: null, userEmail: "community" }])
    })

    it("rejects into the moderator queue and keeps the suggestion only for 'no'", () => {
        castVote(db, { userId: "a", translationId: 100, language: "pl", verdict: "no", suggestedValue: " wódka " })
        castVote(db, { userId: "b", translationId: 100, language: "pl", verdict: "no" })
        expect(castVote(db, { userId: "c", translationId: 100, language: "pl", verdict: "no" }).ok && status(100)).toMatchObject({ s: "rejected", n: 3 })
        castVote(db, { userId: "a", translationId: 101, language: "pl", verdict: "yes", suggestedValue: "ignored" })
        expect(db.prepare(`SELECT translationId t, suggestedValue s FROM translation_votes WHERE userId = 'a' ORDER BY t`).all())
            .toEqual([{ t: 100, s: "wódka" }, { t: 101, s: null }])
    })

    it("refuses a second answer, a wrong language, a closed or missing card", () => {
        castVote(db, { userId: "a", translationId: 100, language: "pl", verdict: "yes" })
        expect(castVote(db, { userId: "a", translationId: 100, language: "pl", verdict: "no" })).toEqual({ ok: false, error: "already_voted" })
        expect(castVote(db, { userId: "b", translationId: 100, language: "ru", verdict: "yes" })).toEqual({ ok: false, error: "language_mismatch" })
        expect(castVote(db, { userId: "b", translationId: 105, language: "pl", verdict: "yes" })).toEqual({ ok: false, error: "closed" })
        expect(castVote(db, { userId: "b", translationId: 999, language: "pl", verdict: "yes" })).toEqual({ ok: false, error: "not_found" })
        expect(status(100)).toMatchObject({ y: 1, n: 0 })
    })

    it("starts over when a moderator changes the value, and lets the same user answer again", () => {
        for (const userId of ["a", "b", "c"]) castVote(db, { userId, translationId: 100, language: "pl", verdict: "yes" })
        expect(status(100)).toMatchObject({ s: "confirmed" })

        upsertTranslation(db, { id: 100, language: "pl", verified: 0 })
        expect(status(100)).toMatchObject({ s: "confirmed", y: 3 }) // значение не менялось - ответы в силе

        upsertTranslation(db, { id: 100, language: "pl", value: "wódka" })
        expect(status(100)).toEqual({ s: null, y: 0, n: 0, v: 0 })
        expect(db.prepare(`SELECT COUNT(*) c FROM translation_votes WHERE translationId = 100 AND stale = 1`).get()).toEqual({ c: 3 })

        expect(selectNextCard(db, { userId: "a", language: "pl", random: () => 0 })?.value).toBe("wódka")
        expect(castVote(db, { userId: "a", translationId: 100, language: "pl", verdict: "no" })).toEqual({ ok: true, status: null })
        expect(status(100)).toMatchObject({ y: 0, n: 1 })
    })
})
