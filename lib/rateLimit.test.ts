import { describe, it, expect } from "vitest";
import { RateLimiter, getClientKey } from "./rateLimit";

describe("RateLimiter", () => {
    it("allows requests up to the limit within a window", () => {
        const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 });
        const now = 1_000_000;

        expect(limiter.check("ip1", now).limited).toBe(false);
        expect(limiter.check("ip1", now + 1).limited).toBe(false);
        expect(limiter.check("ip1", now + 2).limited).toBe(false);
    });

    it("blocks once the limit is exceeded within the same window", () => {
        const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 });
        const now = 1_000_000;

        expect(limiter.check("ip1", now).limited).toBe(false);
        expect(limiter.check("ip1", now + 1).limited).toBe(false);
        const third = limiter.check("ip1", now + 2);
        expect(third.limited).toBe(true);
        expect(third.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("resets the count once a new window starts", () => {
        const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 1 });
        const now = 1_000_000;

        expect(limiter.check("ip1", now).limited).toBe(false);
        expect(limiter.check("ip1", now + 500).limited).toBe(true);
        expect(limiter.check("ip1", now + 1000).limited).toBe(false);
    });

    it("tracks separate keys independently", () => {
        const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 });
        const now = 1_000_000;

        expect(limiter.check("ip1", now).limited).toBe(false);
        expect(limiter.check("ip2", now).limited).toBe(false);
        expect(limiter.check("ip1", now + 1).limited).toBe(true);
        expect(limiter.check("ip2", now + 1).limited).toBe(true);
    });
});

describe("getClientKey", () => {
    it("uses the first entry of x-forwarded-for", () => {
        const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
        expect(getClientKey(headers)).toBe("1.2.3.4");
    });

    it("falls back to x-real-ip when x-forwarded-for is absent", () => {
        const headers = new Headers({ "x-real-ip": "9.9.9.9" });
        expect(getClientKey(headers)).toBe("9.9.9.9");
    });

    it("falls back to a shared 'unknown' key when neither header is present", () => {
        const headers = new Headers();
        expect(getClientKey(headers)).toBe("unknown");
    });
});
