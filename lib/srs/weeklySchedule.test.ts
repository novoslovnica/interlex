import { expect, it } from "vitest"
import { endOfFlashcardWeek, groupFlashcardWeek } from "./weeklySchedule"

it("counts UTC calendar dates independently of the overdue count, even across the year boundary", () => {
    const now = new Date("2026-12-29T10:00:00Z")
    const dates = [
        "2026-12-28T23:59:59Z",
        "2026-12-29T10:00:00Z",
        "2026-12-29T23:59:59Z",
        "2026-12-30T00:00:00Z",
        "2027-01-04T23:59:59Z",
        "2027-01-05T00:00:00Z",
    ].map(date => new Date(date))
    expect(endOfFlashcardWeek(now).toISOString()).toBe("2027-01-05T00:00:00.000Z")
    expect(groupFlashcardWeek(dates, now)).toEqual({
        dueCount: 2,
        days: [
            { date: "2026-12-29", count: 2 }, { date: "2026-12-30", count: 1 },
            { date: "2026-12-31", count: 0 }, { date: "2027-01-01", count: 0 },
            { date: "2027-01-02", count: 0 }, { date: "2027-01-03", count: 0 },
            { date: "2027-01-04", count: 1 },
        ],
    })
})
