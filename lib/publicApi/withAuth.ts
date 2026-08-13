import type { NextRequest, NextResponse } from "next/server"
import { authenticatePublicApiRequest, type AuthenticatedApiKey } from "./auth"
import { publicApiRateLimiters, PUBLIC_API_RATE_LIMITS, type PublicApiCategory } from "./rateLimit"
import { publicApiError } from "./response"

const ERROR_MESSAGES: Record<string, string> = {
    missing_api_key: "Missing API key. Pass it as 'Authorization: Bearer islx_...'.",
    invalid_api_key: "Invalid API key.",
    revoked_api_key: "This API key has been revoked.",
}

type PublicApiHandler<Ctx> = (req: NextRequest, ctx: Ctx & { key: AuthenticatedApiKey }) => Promise<NextResponse>

// roadmap #38 - previously the only way to learn about the limit was to
// actually hit it (a 429). Every response (success or error) now carries
// these, mirroring the GitHub/Stripe convention. peek() right after check()
// is a second Map lookup, not free, but check() itself doesn't return the
// post-increment count and its return type is shared with proxy.ts's IP
// limiter - not worth widening that contract for every caller over one
// extra lookup here.
function applyRateLimitHeaders(response: NextResponse, category: PublicApiCategory, keyId: string, limit: number): NextResponse {
    const peeked = publicApiRateLimiters[category].peek(keyId, undefined, limit)
    response.headers.set("X-RateLimit-Limit", String(limit))
    response.headers.set("X-RateLimit-Remaining", String(peeked?.remaining ?? limit))
    response.headers.set("X-RateLimit-Reset", String(peeked?.resetInSeconds ?? 0))
    return response
}

/**
 * Composes auth + per-key, per-category rate limiting so every
 * app/api/public/v1/** route does this once, not 4+ times. `category`
 * selects which of the three limiters in lib/publicApi/rateLimit.ts governs
 * this route - see that file for why corpus (KWIC) gets a stricter default
 * than words/library. A key's ApiKey.rateLimitOverride, if set, replaces
 * the category default for every category uniformly (not a per-category
 * matrix) - see the field's comment in prisma/auth.schema.prisma.
 */
export function withPublicApiAuth<Ctx = Record<string, never>>(
    category: PublicApiCategory,
    handler: PublicApiHandler<Ctx>,
) {
    return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
        const authResult = await authenticatePublicApiRequest(req)
        if (!authResult.ok) {
            return publicApiError(authResult.status, authResult.code, ERROR_MESSAGES[authResult.code])
        }

        const limit = authResult.key.rateLimitOverride ?? PUBLIC_API_RATE_LIMITS[category]
        const rateLimitResult = publicApiRateLimiters[category].check(authResult.key.id, undefined, limit)
        if (rateLimitResult.limited) {
            const response = publicApiError(429, "rate_limited", "Rate limit exceeded for this API key. Try again later.")
            response.headers.set("Retry-After", String(rateLimitResult.retryAfterSeconds))
            return applyRateLimitHeaders(response, category, authResult.key.id, limit)
        }

        const response = await handler(req, { ...ctx, key: authResult.key })
        return applyRateLimitHeaders(response, category, authResult.key.id, limit)
    }
}
