import { RateLimiter } from "@/lib/rateLimit"

// Three SEPARATE rate limiters, distinct from proxy.ts's IP-based one and
// from each other. Every request under app/api/public/v1/** is rate-limited
// twice, intentionally: proxy.ts's 120/min-per-IP limiter runs first
// (catches unauthenticated/garbage-key flooding), then one of these
// per-category 60ish/min-per-API-key limiters runs inside the route handler
// after a key has been validated (governs a legitimate-but-abusive single
// integration). Do not "simplify" this down to one limiter - they guard
// different things, and the categories intentionally have different
// budgets (see PUBLIC_API_RATE_LIMITS below). Keyed by ApiKey.id (never the
// raw key or its hash), so no secret material lives in the in-memory
// bucket maps.
export type PublicApiCategory = "words" | "library" | "corpus"

// `corpus` (KWIC) is deliberately stricter than the other two: CqlTranslator
// builds N-way self-joins on CorpusToken with no FTS/covering index behind
// multi-segment queries, so a single request is meaningfully more expensive
// than a `words`/`library` lookup - see AGENTS.md "Corpus Syntax Parser"
// for the index shape this is working around. Per-key overrides
// (ApiKey.rateLimitOverride) can raise or lower this for a specific
// integration regardless of category, see lib/publicApi/withAuth.ts.
export const PUBLIC_API_RATE_LIMITS: Record<PublicApiCategory, number> = {
    words: 60,
    library: 60,
    corpus: 20,
}

export const publicApiRateLimiters: Record<PublicApiCategory, RateLimiter> = {
    words: new RateLimiter({ windowMs: 60_000, maxRequests: PUBLIC_API_RATE_LIMITS.words }),
    library: new RateLimiter({ windowMs: 60_000, maxRequests: PUBLIC_API_RATE_LIMITS.library }),
    corpus: new RateLimiter({ windowMs: 60_000, maxRequests: PUBLIC_API_RATE_LIMITS.corpus }),
}
