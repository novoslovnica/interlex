import type { NextRequest, NextResponse } from "next/server"
import { RateLimiter, getClientKey } from "@/lib/rateLimit"
import { PUBLIC_API_RATE_LIMITS, type PublicApiCategory } from "./rateLimit"
import { publicApiError } from "./response"

// Roadmap #78 - the interactive "try it in the browser" playground next to
// /api-docs calls these routes (app/api/playground/v1/**), not the real
// app/api/public/v1/** ones. They share the exact same business logic and
// response envelope (same lib/publicApi/{words,proto,library}.ts functions,
// lib/corpus/kwic.ts), so what a visitor sees in the playground matches
// what a real integration would get - but a playground click must never
// require an API key or count against one (roadmap wording: "запрос из
// конструктора внутри сайта не должен тарифицироваться"). So these routes
// skip authenticatePublicApiRequest() entirely and never touch ApiKey.id /
// ApiKey.requestCount. Abuse protection instead comes from an IP-keyed
// limiter here, using the same per-category ceilings as the real API
// (lib/publicApi/rateLimit.ts) - a playground request is exactly as
// expensive to serve as the equivalent authenticated one, so it should be
// bounded the same way, just against IP instead of ApiKey.id. proxy.ts's
// blanket 120/min-per-IP limiter still runs first, same as every other
// /api/** route - this is a second, category-shaped layer on top of that,
// mirroring how withPublicApiAuth layers its per-key limiter on top of it.
const playgroundRateLimiters: Record<PublicApiCategory, RateLimiter> = {
    words: new RateLimiter({ windowMs: 60_000, maxRequests: PUBLIC_API_RATE_LIMITS.words }),
    library: new RateLimiter({ windowMs: 60_000, maxRequests: PUBLIC_API_RATE_LIMITS.library }),
    corpus: new RateLimiter({ windowMs: 60_000, maxRequests: PUBLIC_API_RATE_LIMITS.corpus }),
}

type PlaygroundHandler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<NextResponse>

export function withPlaygroundLimit<Ctx = Record<string, never>>(
    category: PublicApiCategory,
    handler: PlaygroundHandler<Ctx>,
) {
    return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
        const clientKey = getClientKey(req.headers)
        const limit = PUBLIC_API_RATE_LIMITS[category]
        const result = playgroundRateLimiters[category].check(clientKey, undefined, limit)
        if (result.limited) {
            const response = publicApiError(429, "rate_limited", "Too many playground requests from this address. Try again shortly, or use your own API key against the real endpoint.")
            response.headers.set("Retry-After", String(result.retryAfterSeconds))
            return response
        }
        return handler(req, ctx)
    }
}
