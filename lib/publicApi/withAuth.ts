import type { NextRequest, NextResponse } from "next/server"
import { authenticatePublicApiRequest, type AuthenticatedApiKey } from "./auth"
import { publicApiKeyRateLimiter, PUBLIC_API_RATE_LIMIT_PER_MINUTE } from "./rateLimit"
import { publicApiError } from "./response"

// roadmap #58 - previously the only way to learn about the 60/min limit was
// to actually hit it (a 429). Every response (success or error) now carries
// these, mirroring the GitHub/Stripe convention. peek() right after check()
// is a second Map lookup, not free, but check() itself doesn't return the
// post-increment count and its return type is shared with proxy.ts's IP
// limiter - not worth widening that contract for every caller over one
// extra lookup here.
function applyRateLimitHeaders(response: NextResponse, keyId: string): NextResponse {
    const peeked = publicApiKeyRateLimiter.peek(keyId)
    response.headers.set("X-RateLimit-Limit", String(PUBLIC_API_RATE_LIMIT_PER_MINUTE))
    response.headers.set("X-RateLimit-Remaining", String(peeked?.remaining ?? PUBLIC_API_RATE_LIMIT_PER_MINUTE))
    response.headers.set("X-RateLimit-Reset", String(peeked?.resetInSeconds ?? 0))
    return response
}

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
            return applyRateLimitHeaders(response, authResult.key.id)
        }

        const response = await handler(req, { ...ctx, key: authResult.key })
        return applyRateLimitHeaders(response, authResult.key.id)
    }
}
