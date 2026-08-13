import type { NextRequest } from "next/server"
import { withPlaygroundLimit } from "@/lib/publicApi/playground"
import { publicApiList } from "@/lib/publicApi/response"
import { searchPublicLibrary } from "@/lib/publicApi/library"
import { clampLimit, clampOffset } from "@/lib/publicApi/pagination"

// Mirrors app/api/public/v1/library/route.ts - see lib/publicApi/playground.ts.
export const GET = withPlaygroundLimit("library", async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim() ?? ""
    const limit = clampLimit(Number(searchParams.get("limit")))
    const offset = clampOffset(Number(searchParams.get("offset")))

    const { items, total } = await searchPublicLibrary(search, limit, offset)
    return publicApiList(items, total, limit, offset)
})
