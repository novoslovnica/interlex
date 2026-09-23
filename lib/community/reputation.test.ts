import { describe, it, expect, beforeEach, beforeAll } from "vitest"
import type Database from "better-sqlite3"
import { createDb } from "./testDb"
import { computeReputation } from "./reputation"
import { castVote } from "./translationCards"
import { selectControlCard, castControlVote, shouldServeControl } from "./controlCards"
import { signCard, resolveCardKind } from "./cardToken"
import { fetchReviewQueue, resolveReview, countReviewQueue } from "./moderatorReview"
import { upsertTranslation } from "@/lib/translations"

describe("computeReputation", () => {
    it("treats everyone equally until there is enough evidence", () => {
        expect(computeReputation({ votesResolved: 5, votesAgreed: 0, controlTotal: 4, controlCorrect: 0 })).toMatchObject({ weight: 1, flagged: false })
        expect(computeReputation({ votesResolved: 0, votesAgreed: 0, controlTotal: 0, controlCorrect: 0 })).toEqual({ accuracy: null, weight: 1, flagged: false })
    })

    it("tiers the weight by accuracy over votes and controls together", () => {
        const at = (correct: number) => computeReputation({ votesResolved: 80, votesAgreed: correct - 20, controlTotal: 20, controlCorrect: 20 }).weight
        expect(at(55)).toBe(0.25)
        expect(at(70)).toBe(1)
        expect(at(85)).toBe(1.5)
        expect(at(95)).toBe(2)
    })

    it("zeroes and flags only on failed controls, not on honest disagreement", () => {
        expect(computeReputation({ votesResolved: 50, votesAgreed: 50, controlTotal: 10, controlCorrect: 4 })).toMatchObject({ weight: 0, flagged: true })
        expect(computeReputation({ votesResolved: 50, votesAgreed: 10, controlTotal: 10, controlCorrect: 9 })).toMatchObject({ weight: 0.25, flagged: false })
    })
})

describe("card token", () => {
    beforeAll(() => { process.env.AUTH_SECRET = "test-secret" })

    it("recovers the kind only for the same user and translation", () => {
        const token = signCard("control_no", 105, "u1")
        expect(resolveCardKind(token, 105, "u1")).toBe("control_no")
        expect(resolveCardKind(token, 105, "u2")).toBeNull()
        expect(resolveCardKind(token, 108, "u1")).toBeNull()
        expect(resolveCardKind("garbage", 105, "u1")).toBeNull()
        expect(signCard("regular", 105, "u1")).toHaveLength(token.length) // снаружи неотличимы
    })
})

describe("control cards", () => {
    let db: Database.Database
    beforeEach(() => { db = createDb() })
    const stats = (userId: string) => db.prepare(`SELECT votesTotal vt, controlTotal ct, controlCorrect cc FROM contributor_stats WHERE userId = ?`).get(userId)

    it("serves a moderator-checked translation as is, or with another word's value as a decoy", () => {
        const asIs = selectControlCard(db, { userId: "u1", language: "pl", random: () => 0.1 })
        expect(asIs?.kind).toBe("control_yes")
        expect(["sprawdzony", "nowy"]).toContain(asIs?.card.value)

        const decoy = selectControlCard(db, { userId: "u1", language: "pl", random: () => 0.9 })
        expect(decoy?.kind).toBe("control_no")
        // обманка - значение ДРУГОГО слова той же части речи
        expect(decoy?.card.value).toBe(decoy?.card.translationId === 105 ? "nowy" : "sprawdzony")
    })

    it("has nothing to offer where no translation is moderator-checked", () => {
        expect(selectControlCard(db, { userId: "u1", language: "en" })).toBeNull()
    })

    it("scores the answer without touching the translation's tally", () => {
        expect(castControlVote(db, { userId: "u1", translationId: 105, language: "pl", verdict: "yes", kind: "control_no" })).toEqual({ ok: true })
        expect(castControlVote(db, { userId: "u1", translationId: 108, language: "pl", verdict: "yes", kind: "control_yes" })).toEqual({ ok: true })
        expect(castControlVote(db, { userId: "u1", translationId: 108, language: "pl", verdict: "no", kind: "control_yes" })).toEqual({ ok: false, error: "already_voted" })
        expect(stats("u1")).toEqual({ vt: 0, ct: 2, cc: 1 })
        expect(db.prepare(`SELECT communityYes y, communityNo n, communityStatus s, verified v FROM translations WHERE id = 105`).get())
            .toEqual({ y: 0, n: 0, s: null, v: 1 })
    })

    it("does not count 'unknown' on a control against the participant", () => {
        castControlVote(db, { userId: "u1", translationId: 105, language: "pl", verdict: "unknown", kind: "control_no" })
        expect(stats("u1")).toEqual({ vt: 0, ct: 0, cc: 0 })
    })

    it("calibrates newcomers with a higher share of controls", () => {
        expect(shouldServeControl(db, "u1", "pl", () => 0.2)).toBe(true)
        db.prepare(`INSERT INTO contributor_stats (userId, language, controlTotal) VALUES ('u1', 'pl', 10)`).run()
        expect(shouldServeControl(db, "u1", "pl", () => 0.2)).toBe(false)
        expect(shouldServeControl(db, "u1", "pl", () => 0.05)).toBe(true)
    })

    it("silences a participant who fails the controls", () => {
        db.prepare(`INSERT INTO contributor_stats (userId, language, weight, flagged) VALUES ('spammer', 'pl', 0, 1)`).run()
        for (const userId of ["spammer", "a", "b"]) castVote(db, { userId, translationId: 100, language: "pl", verdict: "yes" })
        // три "верно", но один с нулевым весом - согласия ещё нет
        expect(db.prepare(`SELECT communityYes y, communityStatus s FROM translations WHERE id = 100`).get()).toEqual({ y: 2, s: null })
    })
})

describe("settling votes and the moderator queue", () => {
    let db: Database.Database
    beforeEach(() => { db = createDb() })
    const agreedOf = (translationId: number) => Object.fromEntries(
        (db.prepare(`SELECT userId, agreed FROM translation_votes WHERE translationId = ? ORDER BY id`).all(translationId) as { userId: string; agreed: number | null }[])
            .map((row) => [row.userId, row.agreed])
    )
    const stat = (userId: string) => db.prepare(`SELECT votesTotal vt, votesResolved vr, votesAgreed va FROM contributor_stats WHERE userId = ?`).get(userId)
    const reject = (translationId: number) => {
        castVote(db, { userId: "a", translationId, language: "pl", verdict: "no", suggestedValue: "Wódka" })
        castVote(db, { userId: "b", translationId, language: "pl", verdict: "no", suggestedValue: "wódka" })
        castVote(db, { userId: "c", translationId, language: "pl", verdict: "yes" })
        castVote(db, { userId: "d", translationId, language: "pl", verdict: "no" })
        castVote(db, { userId: "e", translationId, language: "pl", verdict: "unknown" })
        castVote(db, { userId: "f", translationId, language: "pl", verdict: "no" })
    }

    it("judges voters provisionally on consensus; 'unknown' is never judged", () => {
        reject(100)
        expect(agreedOf(100)).toEqual({ a: 1, b: 1, c: 0, d: 1, e: null, f: 1 })
        expect(stat("c")).toEqual({ vt: 1, vr: 1, va: 0 })
        expect(stat("e")).toEqual({ vt: 1, vr: 0, va: 0 })
    })

    it("lists rejected translations with votes and grouped suggestions", () => {
        reject(100)
        expect(countReviewQueue(db, "pl")).toBe(1)
        expect(countReviewQueue(db, "ru")).toBe(0)
        const [item] = fetchReviewQueue(db, { language: "pl", limit: 10, offset: 0 })
        expect(item).toMatchObject({ translationId: 100, value: "woda", communityStatus: "rejected", isv: "voda", context: { ru: "вода", en: "water" } })
        expect(item.votes).toHaveLength(6)
        expect(item.suggestions).toEqual([{ value: "Wódka", count: 2 }])
    })

    it("'keep' overrules the volunteers: verified=1, the lone 'yes' voter was right", () => {
        reject(100)
        const result = resolveReview(db, 100, { kind: "keep" })
        expect(result).toMatchObject({ ok: true, lexemeId: 1, changes: [{ field: "pl.verified", newValue: 1 }] })
        expect(agreedOf(100)).toEqual({ a: 0, b: 0, c: 1, d: 0, e: null, f: 0 })
        expect(stat("c")).toEqual({ vt: 1, vr: 1, va: 1 })
        expect(countReviewQueue(db)).toBe(0)
        expect(resolveReview(db, 100, { kind: "keep" })).toEqual({ ok: false, error: "not_in_queue" })
    })

    it("'replace' keeps the verdict on the old value although the votes go stale", () => {
        reject(100)
        const result = resolveReview(db, 100, { kind: "replace", value: " wódka " })
        expect(result.ok && result.changes.map((change) => change.field).sort()).toEqual(["pl.value", "pl.verified"])
        expect(db.prepare(`SELECT value, verified, communityStatus s FROM translations WHERE id = 100`).get()).toEqual({ value: "wódka", verified: 1, s: null })
        expect(agreedOf(100)).toEqual({ a: 1, b: 1, c: 0, d: 1, e: null, f: 1 })
        expect(db.prepare(`SELECT COUNT(*) c FROM translation_votes WHERE translationId = 100 AND stale = 0`).get()).toEqual({ c: 0 })
        expect(stat("a")).toEqual({ vt: 1, vr: 1, va: 1 })
    })

    it("'clear' empties the value but keeps the row and its votes", () => {
        reject(100)
        expect(resolveReview(db, 100, { kind: "clear" })).toMatchObject({ ok: true })
        expect(db.prepare(`SELECT value, verified FROM translations WHERE id = 100`).get()).toEqual({ value: null, verified: 0 })
        expect(db.prepare(`SELECT COUNT(*) c FROM translation_votes WHERE translationId = 100`).get()).toEqual({ c: 6 })
        expect(countReviewQueue(db)).toBe(0)
        expect(resolveReview(db, 100, { kind: "replace", value: "  " })).toEqual({ ok: false, error: "not_in_queue" })
    })

    it("a moderator verifying elsewhere (admin table) also settles the votes", () => {
        castVote(db, { userId: "a", translationId: 101, language: "pl", verdict: "yes" })
        castVote(db, { userId: "b", translationId: 101, language: "pl", verdict: "no" })
        upsertTranslation(db, { id: 101, language: "pl", verified: 1 })
        expect(agreedOf(101)).toEqual({ a: 1, b: 0 })
    })
})
