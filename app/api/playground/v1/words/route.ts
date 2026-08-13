import type { NextRequest } from "next/server"
import { withPlaygroundLimit } from "@/lib/publicApi/playground"
import { publicApiList } from "@/lib/publicApi/response"
import { searchPublicWords } from "@/lib/publicApi/words"
import { clampLimit, clampOffset } from "@/lib/publicApi/pagination"

// Mirrors app/api/public/v1/words/route.ts - see lib/publicApi/playground.ts
// for why this is a separate, key-less, IP-limited route rather than the
// real one.
export const GET = withPlaygroundLimit("words", async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim() ?? ""
    const limit = clampLimit(Number(searchParams.get("limit")))
    const offset = clampOffset(Number(searchParams.get("offset")))

    const { items, total } = await searchPublicWords(search, limit, offset)
    return publicApiList(items, total, limit, offset)
})
