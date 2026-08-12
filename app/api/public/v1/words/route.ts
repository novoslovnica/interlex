import type { NextRequest } from "next/server"
import { withPublicApiAuth } from "@/lib/publicApi/withAuth"
import { publicApiList } from "@/lib/publicApi/response"
import { searchPublicWords, clampLimit, clampOffset } from "@/lib/publicApi/words"

export const GET = withPublicApiAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim() ?? ""
    const limit = clampLimit(Number(searchParams.get("limit")))
    const offset = clampOffset(Number(searchParams.get("offset")))

    const { items, total } = await searchPublicWords(search, limit, offset)
    return publicApiList(items, total, limit, offset)
})
