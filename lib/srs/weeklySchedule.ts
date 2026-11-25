const DAY_MS = 86_400_000
export const SCHEDULE_DAYS = 7

export interface FlashcardWeek {
    dueCount: number
    days: { date: string; count: number }[]
}

export function startOfUtcDay(now: Date): number {
    return Math.floor(now.getTime() / DAY_MS) * DAY_MS
}

export function endOfFlashcardWeek(now: Date): Date {
    return new Date(startOfUtcDay(now) + SCHEDULE_DAYS * DAY_MS)
}

export function groupFlashcardWeek(dates: readonly Date[], now: Date): FlashcardWeek {
    const start = startOfUtcDay(now)
    const days = Array.from({ length: SCHEDULE_DAYS }, (_, index) => ({
        date: new Date(start + index * DAY_MS).toISOString().slice(0, 10),
        count: 0,
    }))
    let dueCount = 0
    for (const date of dates) {
        const time = date.getTime()
        if (time <= now.getTime()) dueCount++
        const index = Math.floor((time - start) / DAY_MS)
        if (days[index]) days[index].count++
    }
    return { dueCount, days }
}
