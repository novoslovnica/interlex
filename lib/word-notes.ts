import { prismaAuth, prismaData } from "@/lib/prisma"

export async function listWordNotes(userId: string) {
    const notes = await prismaAuth.userWordNote.findMany({
        where: { userId },
        select: { wordId: true, body: true },
        orderBy: [{ updatedAt: "desc" }, { wordId: "asc" }],
    })
    if (!notes.length) return []

    const words = await prismaData.lexeme.findMany({
        where: { id: { in: notes.map(note => note.wordId) }, isPublic: true },
        select: {
            id: true,
            value: true,
            lexemeAllophones: {
                where: { type: "standard", flavor: { code: "CORE" } },
                select: { value: true },
                take: 1,
            },
        },
    })
    const titles = new Map(words.map(word => [word.id, word.lexemeAllophones[0]?.value || word.value]))
    return notes.map(note => ({ ...note, title: titles.get(note.wordId) || null }))
}
