import { NextResponse } from "next/server"
import { prismaAuth, prismaData, prismaLibrary, prismaCorpus, prismaHistorical } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Readiness plus release identity: a surviving old process must not pass cutover. */
export async function GET() {
    const headers = { "Cache-Control": "no-store" }
    try {
        await Promise.all([
            prismaAuth.$queryRaw`SELECT 1 FROM "User" LIMIT 1`,
            prismaData.$queryRaw`SELECT 1 FROM "lexemes" LIMIT 1`,
            prismaLibrary.$queryRaw`SELECT 1 FROM "LibraryEntry" LIMIT 1`,
            prismaCorpus.$queryRaw`SELECT 1 FROM "CorpusToken" LIMIT 1`,
            prismaHistorical.$queryRaw`SELECT 1 FROM "HistoricalDocument" LIMIT 1`,
        ])
        return NextResponse.json({ status: "ok", release: process.env.RELEASE_COMMIT ?? "development" }, { headers })
    } catch {
        return NextResponse.json({ status: "unavailable" }, { status: 503, headers })
    }
}
