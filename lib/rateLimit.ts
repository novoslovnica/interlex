// In-memory fixed-window rate limiter, keyed by an arbitrary string (client
// IP in practice). Correct for this project's deployment: a single
// long-running `next start` process (see AGENTS.md - no Redis/external
// store anywhere in this stack), so a module-level Map persists for the
// life of that one process. Would need a shared store (Redis etc.) if this
// app were ever deployed across multiple server instances/regions, which it
// currently isn't.
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

export interface RateLimitResult {
    limited: boolean;
    retryAfterSeconds: number;
}

interface Bucket {
    count: number;
    windowStart: number;
}

// Bounds how often a stale-bucket sweep runs (probabilistically, on check())
// rather than on a timer - avoids unbounded Map growth from one-off visitors
// over a long process uptime without needing a separate interval/cron.
const SWEEP_PROBABILITY = 0.01;
const STALE_AFTER_WINDOWS = 2;

export class RateLimiter {
    private buckets = new Map<string, Bucket>();

    constructor(private config: RateLimitConfig) {}

    check(key: string, now: number = Date.now()): RateLimitResult {
        if (Math.random() < SWEEP_PROBABILITY) this.sweep(now);

        const bucket = this.buckets.get(key);

        if (!bucket || now - bucket.windowStart >= this.config.windowMs) {
            this.buckets.set(key, { count: 1, windowStart: now });
            return { limited: false, retryAfterSeconds: 0 };
        }

        bucket.count += 1;
        if (bucket.count > this.config.maxRequests) {
            const retryAfterSeconds = Math.ceil((bucket.windowStart + this.config.windowMs - now) / 1000);
            return { limited: true, retryAfterSeconds };
        }
        return { limited: false, retryAfterSeconds: 0 };
    }

    private sweep(now: number): void {
        const staleBefore = now - this.config.windowMs * STALE_AFTER_WINDOWS;
        for (const [key, bucket] of this.buckets) {
            if (bucket.windowStart < staleBefore) this.buckets.delete(key);
        }
    }

    get size(): number {
        return this.buckets.size;
    }
}

/**
 * Best-effort client identity from standard proxy headers. `x-forwarded-for`
 * may carry a comma-separated chain when passed through multiple proxies -
 * the first entry is the original client. Falls back to a single shared
 * "unknown" bucket when neither header is present (e.g. no reverse proxy in
 * front of the app at all) - degraded to a coarse global limit rather than
 * no limit, not a per-client one.
 */
export function getClientKey(headers: Pick<Headers, "get">): string {
    const forwardedFor = headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    return headers.get("x-real-ip") ?? "unknown";
}
