import type { NextRequest, NextResponse } from "next/server"
import { authenticatePublicApiRequest, type AuthenticatedApiKey } from "./auth"
import { publicApiKeyRateLimiter } from "./rateLimit"
import { publicApiError } from "./response"

const ERROR_MESSAGES: Record<string, string> = {
    missing_api_key: "Missing API key. Pass it as 'Authorization: Bearer islx_...'.",
    invalid_api_key: "Invalid API key.",
    revoked_api_key: "This API key has been revoked.",
}

type PublicApiHandler<Ctx> = (req: NextRequest, ctx: Ctx & { key: AuthenticatedApiKey }) => Promise<NextResponse>

/** Composes auth + per-key rate limiting so every app/api/public/v1/** route does this once, not 4+ times. */
export function withPublicApiAuth<Ctx = Record<string, never>>(handler: PublicApiHandler<Ctx>) {
    return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
        const authResult = await authenticatePublicApiRequest(req)
        if (!authResult.ok) {
            return publicApiError(authResult.status, authResult.code, ERROR_MESSAGES[authResult.code])
        }

        const rateLimitResult = publicApiKeyRateLimiter.check(authResult.key.id)
        if (rateLimitResult.limited) {
            const response = publicApiError(429, "rate_limited", "Rate limit exceeded for this API key. Try again later.")
            response.headers.set("Retry-After", String(rateLimitResult.retryAfterSeconds))
            return response
        }

        return handler(req, { ...ctx, key: authResult.key })
    }
}
