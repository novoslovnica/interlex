import type { NextRequest } from "next/server"
import { withPublicApiAuth } from "@/lib/publicApi/withAuth"
import { publicApiError, publicApiList } from "@/lib/publicApi/response"
import { searchKwic, clampKwicLimit, clampKwicOffset, CqlQueryError } from "@/lib/corpus/kwic"

const MAX_QUERY_LENGTH = 500

// POST, not GET - a CQL query string can contain characters (quotes,
// brackets, ampersands) that are awkward/unsafe to round-trip through a URL
// query param, and this endpoint is meaningfully heavier than a GET lookup
// (see lib/publicApi/rateLimit.ts's "corpus" category default) - a POST
// body better signals "this is a real query, not a cacheable resource
// fetch" to intermediaries.
export const POST = withPublicApiAuth("corpus", async (req: NextRequest) => {
    const body = await req.json().catch(() => null)
    const query = typeof body?.query === "string" ? body.query : ""
    if (!query.trim()) {
        return publicApiError(400, "invalid_request", "Missing 'query' (CQL string, e.g. '[lemma=\"dom\"]').")
    }
    if (query.length > MAX_QUERY_LENGTH) {
        return publicApiError(400, "invalid_request", `Query too long (max ${MAX_QUERY_LENGTH} characters).`)
    }
    const documentSlug = typeof body?.documentSlug === "string" && body.documentSlug.trim() ? body.documentSlug.trim() : undefined

    const limit = clampKwicLimit(Number(body?.limit))
    const offset = clampKwicOffset(Number(body?.offset))

    try {
        const { items, total } = searchKwic(query, limit, offset, documentSlug)
        return publicApiList(items, total, limit, offset)
    } catch (e) {
        if (e instanceof CqlQueryError) {
            return publicApiError(400, "invalid_cql", e.message)
        }
        throw e
    }
})
