import type { NextRequest } from "next/server"
import { withPlaygroundLimit } from "@/lib/publicApi/playground"
import { publicApiError, publicApiItem } from "@/lib/publicApi/response"
import { getPublicLibraryEntryBySlug } from "@/lib/publicApi/library"

// Mirrors app/api/public/v1/library/[slug]/route.ts - see lib/publicApi/playground.ts.
export const GET = withPlaygroundLimit<{ params: Promise<{ slug: string }> }>("library", async (_req: NextRequest, { params }) => {
    const { slug } = await params
    const entry = await getPublicLibraryEntryBySlug(slug)
    if (!entry) {
        return publicApiError(404, "not_found", "No public library entry found for this slug.")
    }
    return publicApiItem(entry)
})
