import { describe, it, expect } from "vitest";
import { publicApiKeyRateLimiter, PUBLIC_API_RATE_LIMIT_PER_MINUTE } from "./rateLimit";

describe("publicApiKeyRateLimiter", () => {
    it("is configured with the documented per-key budget of 60/min", () => {
        expect(PUBLIC_API_RATE_LIMIT_PER_MINUTE).toBe(60);
    });

    it("allows up to the configured max requests per key then blocks", () => {
        // publicApiKeyRateLimiter is a module-level singleton (shared across
        // every route handler and every test in this file) - use a unique key
        // per test so runs don't interfere with each other.
        const key = `test-key-${Date.now()}-${Math.random()}`;
        const now = 1_000_000;

        for (let i = 0; i < PUBLIC_API_RATE_LIMIT_PER_MINUTE; i++) {
            expect(publicApiKeyRateLimiter.check(key, now + i).limited).toBe(false);
        }
        const overLimit = publicApiKeyRateLimiter.check(key, now + PUBLIC_API_RATE_LIMIT_PER_MINUTE);
        expect(overLimit.limited).toBe(true);
        expect(overLimit.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("tracks a different key (e.g. a second API key) independently", () => {
        const keyA = `test-key-a-${Date.now()}`;
        const keyB = `test-key-b-${Date.now()}`;
        const now = 2_000_000;

        for (let i = 0; i < PUBLIC_API_RATE_LIMIT_PER_MINUTE; i++) {
            publicApiKeyRateLimiter.check(keyA, now + i);
        }
        expect(publicApiKeyRateLimiter.check(keyA, now).limited).toBe(true);
        expect(publicApiKeyRateLimiter.check(keyB, now).limited).toBe(false);
    });
});
