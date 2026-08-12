import type { NextRequest } from "next/server"
import { prismaAuth } from "@/lib/prisma"
import { API_KEY_PREFIX, hashApiKey } from "@/lib/apiKeyCrypto"

export interface AuthenticatedApiKey {
    id: string
    userId: string
    name: string
}

export type PublicApiAuthResult =
    | { ok: true; key: AuthenticatedApiKey }
    | { ok: false; status: 401; code: "missing_api_key" | "invalid_api_key" | "revoked_api_key" }

/**
 * Validates the `Authorization: Bearer islx_...` header against ApiKey.
 * Runs in the Node runtime (app/api/public/v1/** route handlers, not
 * proxy.ts, which stays Edge-only and can't do this DB lookup - same reason
 * @/auth is avoided there). Verification is hash-then-lookup via keyHash's
 * unique index, not a manual byte comparison, so crypto.timingSafeEqual
 * (used for the Telegram HMAC check) doesn't apply - see the ApiKey model
 * comment in prisma/auth.schema.prisma for the full reasoning.
 */
export async function authenticatePublicApiRequest(req: NextRequest): Promise<PublicApiAuthResult> {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
        return { ok: false, status: 401, code: "missing_api_key" }
    }

    const rawKey = authHeader.slice("Bearer ".length).trim()
    if (!rawKey.startsWith(API_KEY_PREFIX)) {
        // Malformed tokens short-circuit before any DB hit.
        return { ok: false, status: 401, code: "invalid_api_key" }
    }

    const keyHash = hashApiKey(rawKey)
    const record = await prismaAuth.apiKey.findUnique({ where: { keyHash } })
    if (!record) {
        return { ok: false, status: 401, code: "invalid_api_key" }
    }
    if (record.revokedAt) {
        return { ok: false, status: 401, code: "revoked_api_key" }
    }

    // Fire-and-forget usage bump - a failure here must never fail the request.
    prismaAuth.$executeRaw`UPDATE api_keys SET "requestCount" = "requestCount" + 1, "lastUsedAt" = CURRENT_TIMESTAMP WHERE id = ${record.id}`
        .catch(() => {})

    return { ok: true, key: { id: record.id, userId: record.userId, name: record.name } }
}
