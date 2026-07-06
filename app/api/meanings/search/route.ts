import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get("query") || ""

        if (!query.trim()) return NextResponse.json([])

        const meanings = await db.meaning.findMany({
            where: {
                word: {
                    value: { contains: query },
                },
            },
            select: {
                id: true,
                meaning: true,
                word: {
                    select: { id: true, value: true },
                },
            },
            take: 20,
        })

        return NextResponse.json(meanings)
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}