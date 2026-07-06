import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get("query") || ""

        if (!query.trim()) return NextResponse.json([])

        const words = await db.word.findMany({
            where: {
                value: { contains: query },
            },
            select: {
                id: true,
                value: true,
                isv: true,
            },
            take: 20,
        })

        return NextResponse.json(words)
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}
