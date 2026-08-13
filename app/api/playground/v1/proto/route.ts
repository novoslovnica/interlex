import type { NextRequest } from "next/server"
import { withPlaygroundLimit } from "@/lib/publicApi/playground"
import { publicApiList } from "@/lib/publicApi/response"
import { clampLimit, clampOffset } from "@/lib/publicApi/pagination"
import { searchPublicProtoWords } from "@/lib/publicApi/proto"

// Mirrors app/api/public/v1/proto/route.ts - see lib/publicApi/playground.ts.
export const GET = withPlaygroundLimit("words", async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim() ?? ""
    const limit = clampLimit(Number(searchParams.get("limit")))
    const offset = clampOffset(Number(searchParams.get("offset")))

    const { items, total } = await searchPublicProtoWords(search, limit, offset)
    return publicApiList(items, total, limit, offset)
})
