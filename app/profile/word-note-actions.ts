"use server"

import { auth } from "@/auth"
import { prismaAuth, prismaData } from "@/lib/prisma"
import { WORD_NOTE_LIMIT } from "@/lib/word-note-limit"
import { revalidatePath } from "next/cache"

export async function writeWordNote(wordId: number, form: FormData) {
    const userId = (await auth())?.user?.id
    if (!userId) return { status: "signedOut" } as const
    if (!Number.isSafeInteger(wordId) || wordId < 1) return { status: "unavailable" } as const

    const where = { userId, wordId }
    if (form.get("intent") === "delete") {
        await prismaAuth.userWordNote.deleteMany({ where })
        revalidatePath("/profile")
        revalidatePath(`/words/${wordId}`)
        return { status: "deleted", body: "" } as const
    }

    const input = form.get("body")
    const body = typeof input === "string" ? input.trim() : ""
    if (!body || body.length > WORD_NOTE_LIMIT) return { status: "invalid" } as const

    const word = await prismaData.lexeme.findFirst({ where: { id: wordId, isPublic: true }, select: { id: true } })
    if (!word) return { status: "unavailable" } as const

    await prismaAuth.userWordNote.upsert({
        where: { userId_wordId: where },
        create: { ...where, body },
        update: { body },
    })
    revalidatePath("/profile")
    revalidatePath(`/words/${wordId}`)
    return { status: "saved", body } as const
}
