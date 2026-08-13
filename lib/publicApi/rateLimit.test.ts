import { describe, it, expect } from "vitest";
import { publicApiRateLimiters, PUBLIC_API_RATE_LIMITS } from "./rateLimit";

describe("publicApiRateLimiters", () => {
    it("is configured with the documented per-category budgets", () => {
        expect(PUBLIC_API_RATE_LIMITS.words).toBe(60);
        expect(PUBLIC_API_RATE_LIMITS.library).toBe(60);
        expect(PUBLIC_API_RATE_LIMITS.corpus).toBe(20);
    });

    it("allows up to the configured max requests per key then blocks (words)", () => {
        // Each limiter is a module-level singleton (shared across every route
        // handler and every test in this file) - use a unique key per test so
        // runs don't interfere with each other.
        const key = `test-key-${Date.now()}-${Math.random()}`;
        const now = 1_000_000;
        const limiter = publicApiRateLimiters.words;

        for (let i = 0; i < PUBLIC_API_RATE_LIMITS.words; i++) {
            expect(limiter.check(key, now + i).limited).toBe(false);
        }
        const overLimit = limiter.check(key, now + PUBLIC_API_RATE_LIMITS.words);
        expect(overLimit.limited).toBe(true);
        expect(overLimit.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("tracks a different key (e.g. a second API key) independently", () => {
        const keyA = `test-key-a-${Date.now()}`;
        const keyB = `test-key-b-${Date.now()}`;
        const now = 2_000_000;
        const limiter = publicApiRateLimiters.words;

        for (let i = 0; i < PUBLIC_API_RATE_LIMITS.words; i++) {
            limiter.check(keyA, now + i);
        }
        expect(limiter.check(keyA, now).limited).toBe(true);
        expect(limiter.check(keyB, now).limited).toBe(false);
    });

    it("tracks the corpus category with its own, stricter budget", () => {
        const key = `test-key-corpus-${Date.now()}`;
        const now = 3_000_000;
        const limiter = publicApiRateLimiters.corpus;

        for (let i = 0; i < PUBLIC_API_RATE_LIMITS.corpus; i++) {
            expect(limiter.check(key, now + i).limited).toBe(false);
        }
        expect(limiter.check(key, now + PUBLIC_API_RATE_LIMITS.corpus).limited).toBe(true);
    });

    it("honors a per-key maxRequestsOverride regardless of the category default", () => {
        const key = `test-key-override-${Date.now()}`;
        const now = 4_000_000;
        const limiter = publicApiRateLimiters.words; // default 60, but override to 3

        for (let i = 0; i < 3; i++) {
            expect(limiter.check(key, now + i, 3).limited).toBe(false);
        }
        expect(limiter.check(key, now + 3, 3).limited).toBe(true);
    });

    it("peek() reflects the same override without consuming a request", () => {
        const key = `test-key-peek-override-${Date.now()}`;
        const now = 5_000_000;
        const limiter = publicApiRateLimiters.words;

        limiter.check(key, now, 3);
        limiter.check(key, now + 1, 3);
        const peeked = limiter.peek(key, now + 1, 3);
        expect(peeked?.count).toBe(2);
        expect(peeked?.remaining).toBe(1);
    });
});
