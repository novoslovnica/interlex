import type { NextRequest } from "next/server"
import { withPublicApiAuth } from "@/lib/publicApi/withAuth"
import { publicApiError, publicApiItem } from "@/lib/publicApi/response"
import { getPublicWordBySlug } from "@/lib/publicApi/words"

export const GET = withPublicApiAuth<{ params: Promise<{ slug: string }> }>(async (_req: NextRequest, { params }) => {
    const { slug } = await params
    const word = await getPublicWordBySlug(slug)
    // Same response for "doesn't exist" and "exists but hidden" (isPublic=false)
    // - no distinguishable error, so hidden-lexeme existence isn't leakable.
    if (!word) {
        return publicApiError(404, "not_found", "No public word found for this slug.")
    }
    return publicApiItem(word)
})
