import { prismaAuth, prismaData } from "@/lib/prisma"
import { endOfFlashcardWeek, groupFlashcardWeek } from "./weeklySchedule"

export async function getDueFlashcardIds(userId: string, now = new Date()): Promise<number[]> {
    const due = await prismaAuth.flashcardProgress.findMany({
        where: { userId, nextReviewAt: { lte: now } },
        orderBy: [{ nextReviewAt: "asc" }, { wordId: "asc" }],
        select: { wordId: true },
    })
    const available = await availableWordIds(due.map(card => card.wordId))
    return due.map(card => card.wordId).filter(id => available.has(id))
}

async function availableWordIds(ids: number[]) {
    // Progress lives in auth.db. Check availability separately in interlex.db.
    const available = new Set<number>()
    const batchSize = 500
    for (let offset = 0; offset < ids.length; offset += batchSize) {
        const words = await prismaData.lexeme.findMany({
            where: {
                id: { in: ids.slice(offset, offset + batchSize) },
                isPublic: true,
                value: { not: null },
            },
            select: { id: true },
        })
        for (const word of words) available.add(word.id)
    }
    return available
}

export async function getFlashcardWeek(userId: string, now = new Date()) {
    const progress = await prismaAuth.flashcardProgress.findMany({
        where: { userId, nextReviewAt: { lt: endOfFlashcardWeek(now) } },
        select: { wordId: true, nextReviewAt: true },
    })
    const available = await availableWordIds(progress.map(card => card.wordId))
    return groupFlashcardWeek(progress.filter(card => available.has(card.wordId)).map(card => card.nextReviewAt), now)
}
