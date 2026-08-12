import { RateLimiter } from "@/lib/rateLimit"

// A SECOND rate limiter, distinct from proxy.ts's IP-based one. Every
// request under app/api/public/v1/** is rate-limited twice, intentionally:
// proxy.ts's 120/min-per-IP limiter runs first (catches unauthenticated /
// garbage-key flooding), then this 60/min-per-API-key limiter runs inside
// the route handler after a key has been validated (governs a legitimate-
// but-abusive single integration). Do not "simplify" this down to one
// limiter - they guard different things. Keyed by ApiKey.id (never the raw
// key or its hash), so no secret material lives in the in-memory bucket map.
export const PUBLIC_API_RATE_LIMIT_PER_MINUTE = 60

export const publicApiKeyRateLimiter = new RateLimiter({
    windowMs: 60_000,
    maxRequests: PUBLIC_API_RATE_LIMIT_PER_MINUTE,
})
