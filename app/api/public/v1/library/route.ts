import type { NextRequest } from "next/server"
import { withPublicApiAuth } from "@/lib/publicApi/withAuth"
import { publicApiList } from "@/lib/publicApi/response"
import { searchPublicLibrary } from "@/lib/publicApi/library"
import { clampLimit, clampOffset } from "@/lib/publicApi/pagination"

export const GET = withPublicApiAuth("library", async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search")?.trim() ?? ""
    const limit = clampLimit(Number(searchParams.get("limit")))
    const offset = clampOffset(Number(searchParams.get("offset")))

    const { items, total } = await searchPublicLibrary(search, limit, offset)
    return publicApiList(items, total, limit, offset)
})
