import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get("query") || ""

        if (!query.trim()) return NextResponse.json([])

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
                lexemeAllophones: {
                    where: { flavor: { code: 'CORE' }, type: 'standard' },
                    select: { value: true },
                    take: 1,
                },
            },
            take: 20,
        })

        const result = words.map(w => ({
            id: w.id,
            value: w.value,
            isv: w.lexemeAllophones[0]?.value ?? w.value,
        }))

        return NextResponse.json(result)
    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}