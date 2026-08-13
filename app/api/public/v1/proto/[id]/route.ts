import type { NextRequest } from "next/server"
import { withPublicApiAuth } from "@/lib/publicApi/withAuth"
import { publicApiError, publicApiItem } from "@/lib/publicApi/response"
import { getPublicProtoWordById } from "@/lib/publicApi/proto"

export const GET = withPublicApiAuth<{ params: Promise<{ id: string }> }>("words", async (_req: NextRequest, { params }) => {
    const { id: rawId } = await params
    const id = Number(rawId)
    if (!Number.isInteger(id) || id <= 0) {
        return publicApiError(400, "invalid_parameter", "id must be a positive integer.")
    }

    const word = await getPublicProtoWordById(id)
    if (!word) {
        return publicApiError(404, "not_found", "No Proto-Slavic word found for this id.")
    }
    return publicApiItem(word)
})
