import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!await checkPermission(session, Feature.RootsEdit)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { id } = await params
        const rootId = parseInt(id)
        if (isNaN(rootId)) {
            return NextResponse.json({ error: "Invalid root id" }, { status: 400 })
        }

        const { searchParams } = new URL(request.url)
        const query = searchParams.get("query") || ""
        if (!query.trim()) return NextResponse.json([])

        const linkedIds = (
            await db.lexemeMorpheme.findMany({
                where: { morphemeId: rootId },
                select: { id: true, lexemeId: true },
            })
        ).reduce((map, rw) => {
            if (rw.lexemeId) map.set(rw.lexemeId, rw.id)
            return map
        }, new Map<number, number>())

        const words = await db.lexeme.findMany({
            where: {
                OR: [
                    { value: { contains: query } },
                    { lexemeAllophones: { some: { value: { contains: query } } } },
                ],
            },
            select: {
                id: true,
                value: true,
                meanings: {
                    select: { meaning: true },
                    take: 1,
                },
                lexemeAllophones: {
                    select: { value: true },
                },
            },
            take: 200,
        })

        const result = words.map(w => ({
            id: w.id,
            value: w.value,
            allophones: w.lexemeAllophones.map(a => a.value),
            meaning: w.meanings[0]?.meaning || null,
            isLinked: linkedIds.has(w.id),
            lexemeMorphemeId: linkedIds.get(w.id) || null,
        }))

        return NextResponse.json(result)
    } catch (error) {
        console.error("API Root Word Search Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}