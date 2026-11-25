import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    revalidatePath: vi.fn(),
}))
vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock("@/lib/prisma", () => ({
    prismaAuth: { userWordNote: { upsert: mocks.upsert, deleteMany: mocks.deleteMany } },
    prismaData: { lexeme: { findFirst: mocks.findFirst } },
}))

import { writeWordNote } from "./word-note-actions"

function form(intent: string, body = "") {
    const data = new FormData()
    data.set("intent", intent)
    data.set("body", body)
    data.set("userId", "another-user")
    return data
}

beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "owner" } })
    mocks.findFirst.mockResolvedValue({ id: 21 })
})

describe("personal word notes", () => {
    it("rejects unauthenticated writes and overlong notes before touching either database", async () => {
        mocks.auth.mockResolvedValueOnce(null)
        await expect(writeWordNote(21, form("save", "private"))).resolves.toEqual({ status: "signedOut" })
        await expect(writeWordNote(21, form("save", "a".repeat(2001)))).resolves.toEqual({ status: "invalid" })
        expect(mocks.findFirst).not.toHaveBeenCalled()
        expect(mocks.upsert).not.toHaveBeenCalled()
    })

    it("writes only to the authenticated user's note for a public word", async () => {
        await expect(writeWordNote(21, form("save", " private "))).resolves.toEqual({ status: "saved", body: "private" })
        expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: 21, isPublic: true }, select: { id: true } })
        expect(mocks.upsert).toHaveBeenCalledWith({
            where: { userId_wordId: { userId: "owner", wordId: 21 } },
            create: { userId: "owner", wordId: 21, body: "private" },
            update: { body: "private" },
        })
    })

    it("lets the owner delete a note when the original word is unavailable", async () => {
        await expect(writeWordNote(21, form("delete"))).resolves.toEqual({ status: "deleted", body: "" })
        expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: "owner", wordId: 21 } })
        expect(mocks.findFirst).not.toHaveBeenCalled()
    })
})
