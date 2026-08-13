import type { NextRequest } from "next/server"
import { withPlaygroundLimit } from "@/lib/publicApi/playground"
import { publicApiError, publicApiList } from "@/lib/publicApi/response"
import { searchKwic, clampKwicLimit, clampKwicOffset, CqlQueryError } from "@/lib/corpus/kwic"

const MAX_QUERY_LENGTH = 500

// Mirrors app/api/public/v1/corpus/kwic/route.ts - see lib/publicApi/playground.ts.
export const POST = withPlaygroundLimit("corpus", async (req: NextRequest) => {
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
