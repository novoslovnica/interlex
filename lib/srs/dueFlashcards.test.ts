import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ progress: vi.fn(), lexemes: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
    prismaAuth: { flashcardProgress: { findMany: mocks.progress } },
    prismaData: { lexeme: { findMany: mocks.lexemes } },
}))

import { getDueFlashcardIds } from "./dueFlashcards"

describe("due flashcards", () => {
    it("scopes the schedule to its owner and time cutoff, then keeps only public words in schedule order", async () => {
        const cutoff = new Date("2026-11-25T10:00:00Z")
        mocks.progress.mockResolvedValue([{ wordId: 3 }, { wordId: 2 }, { wordId: 1 }])
        mocks.lexemes.mockResolvedValue([{ id: 1 }, { id: 3 }])

        expect(await getDueFlashcardIds("learner", cutoff)).toEqual([3, 1])
        expect(mocks.progress).toHaveBeenCalledWith({
            where: { userId: "learner", nextReviewAt: { lte: cutoff } },
            orderBy: [{ nextReviewAt: "asc" }, { wordId: "asc" }],
            select: { wordId: true },
        })
        expect(mocks.lexemes).toHaveBeenCalledWith({
            where: { id: { in: [3, 2, 1] }, isPublic: true, value: { not: null } },
            select: { id: true },
        })
    })
})
