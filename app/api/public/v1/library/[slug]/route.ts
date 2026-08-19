import type { NextRequest } from "next/server"
import { withPublicApiAuth } from "@/lib/publicApi/withAuth"
import { publicApiError, publicApiItem } from "@/lib/publicApi/response"
import { getPublicLibraryEntryBySlug } from "@/lib/publicApi/library"
import { decodeSlugParam } from "@/lib/slug"

export const GET = withPublicApiAuth<{ params: Promise<{ slug: string }> }>("library", async (_req: NextRequest, { params }) => {
    const { slug: rawSlug } = await params
    const slug = decodeSlugParam(rawSlug)
    const entry = await getPublicLibraryEntryBySlug(slug)
    // Same response for "doesn't exist" and "exists but hidden" (isPublic=false)
    // - no distinguishable error, matches app/api/public/v1/words/[slug]/route.ts.
    if (!entry) {
        return publicApiError(404, "not_found", "No public library entry found for this slug.")
    }
    return publicApiItem(entry)
})
