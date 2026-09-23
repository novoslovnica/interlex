import { describe, it, expect, beforeEach } from "vitest"
import type Database from "better-sqlite3"
import { createDb } from "./testDb"
import { castVote } from "./translationCards"
import { castControlVote } from "./controlCards"
import { computeStreak, fetchContributorSummary, fetchLeaderboard, fetchCompleteness, fetchModeratorCandidates } from "./publicStats"

describe("computeStreak", () => {
    it("counts consecutive days back from today, tolerating an unfinished today", () => {
        expect(computeStreak(["2026-09-23", "2026-09-22", "2026-09-21", "2026-09-19"], "2026-09-23")).toBe(3)
        expect(computeStreak(["2026-09-22", "2026-09-21"], "2026-09-23")).toBe(2)
        expect(computeStreak(["2026-09-20"], "2026-09-23")).toBe(0)
        expect(computeStreak([], "2026-09-23")).toBe(0)
    })
})

describe("public stats", () => {
    let db: Database.Database
    beforeEach(() => {
        db = createDb()
        for (const userId of ["a", "b", "c"]) castVote(db, { userId, translationId: 100, language: "pl", verdict: "yes" })
        castVote(db, { userId: "a", translationId: 101, language: "pl", verdict: "no" })
        castControlVote(db, { userId: "a", translationId: 105, language: "pl", verdict: "yes", kind: "control_yes" })
    })

    it("summarizes a contributor without counting control cards", () => {
        const summary = fetchContributorSummary(db, "a")!
        expect(summary).toMatchObject({ votesTotal: 2, votesResolved: 1, votesAgreed: 1, accuracy: 1, confirmedTranslations: 1, streakDays: 1 })
        expect(summary.languages).toEqual([{ language: "pl", votesTotal: 2, votesResolved: 1, votesAgreed: 1, accuracy: 1 }])
        expect(summary.weekly).toHaveLength(1)
        expect(fetchContributorSummary(db, "nobody")).toBeNull()
    })

    it("ranks by votes and hides flagged participants", () => {
        expect(fetchLeaderboard(db, {}).map((row) => row.userId)).toEqual(["a", "b", "c"])
        db.prepare(`UPDATE contributor_stats SET flagged = 1 WHERE userId = 'a'`).run()
        expect(fetchLeaderboard(db, { language: "pl", sinceDays: 7 }).map((row) => row.userId)).toEqual(["b", "c"])
    })

    it("splits each language into moderator / community / in progress / queued / unchecked", () => {
        const pl = fetchCompleteness(db).find((row) => row.language === "pl")!
        // 100 confirmed, 101 in progress, 105/108 verified, 102/103 unchecked, 104 пустой не считается
        expect(pl).toEqual({ language: "pl", total: 6, moderator: 2, community: 1, inProgress: 1, queued: 0, unchecked: 2 })
    })

    it("proposes moderators only above every threshold", () => {
        expect(fetchModeratorCandidates(db)).toEqual([])
        db.prepare(`UPDATE contributor_stats SET votesResolved = 250, accuracy = 0.95, controlTotal = 12, controlCorrect = 11 WHERE userId = 'a'`).run()
        expect(fetchModeratorCandidates(db)).toMatchObject([{ userId: "a", language: "pl" }])
        db.prepare(`UPDATE contributor_stats SET controlCorrect = 8 WHERE userId = 'a'`).run()
        expect(fetchModeratorCandidates(db)).toEqual([])
    })
})
