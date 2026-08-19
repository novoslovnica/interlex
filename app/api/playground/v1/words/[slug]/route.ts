import type { NextRequest } from "next/server"
import { withPlaygroundLimit } from "@/lib/publicApi/playground"
import { publicApiError, publicApiItem } from "@/lib/publicApi/response"
import { getPublicWordBySlug } from "@/lib/publicApi/words"
import { decodeSlugParam } from "@/lib/slug"

// Mirrors app/api/public/v1/words/[slug]/route.ts - see lib/publicApi/playground.ts.
export const GET = withPlaygroundLimit<{ params: Promise<{ slug: string }> }>("words", async (_req: NextRequest, { params }) => {
    const { slug: rawSlug } = await params
    const slug = decodeSlugParam(rawSlug)
    const word = await getPublicWordBySlug(slug)
    if (!word) {
        return publicApiError(404, "not_found", "No public word found for this slug.")
    }
    return publicApiItem(word)
})
