import { describe, it, expect } from "vitest";
import { sm2Review, DEFAULT_SRS_STATE, QUALITY_BY_BUTTON } from "./sm2";

// Reference values hand-computed from the textbook SM-2 formula
// (Woźniak 1987): EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)).
describe("sm2Review", () => {
    it("first review with quality=5 (easy): interval=1, EF grows by 0.1", () => {
        const now = new Date("2026-01-01T00:00:00Z");
        const result = sm2Review(DEFAULT_SRS_STATE, 5, now);
        expect(result.repetitions).toBe(1);
        expect(result.intervalDays).toBe(1);
        expect(result.easeFactor).toBeCloseTo(2.6, 5);
        expect(result.nextReviewAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    });

    it("second consecutive successful review: interval jumps to 6 days", () => {
        const now = new Date("2026-01-02T00:00:00Z");
        const afterFirst = sm2Review(DEFAULT_SRS_STATE, 5, now);
        const result = sm2Review(afterFirst, 5, now);
        expect(result.repetitions).toBe(2);
        expect(result.intervalDays).toBe(6);
        expect(result.easeFactor).toBeCloseTo(2.7, 5);
    });

    it("third+ successful review: interval = round(previous interval * EF)", () => {
        const now = new Date("2026-01-02T00:00:00Z");
        let state = sm2Review(DEFAULT_SRS_STATE, 5, now);
        state = sm2Review(state, 5, now);
        const result = sm2Review(state, 5, now);
        expect(result.repetitions).toBe(3);
        // interval was 6, EF was 2.7 -> round(6 * 2.7) = 16
        expect(result.intervalDays).toBe(16);
        expect(result.easeFactor).toBeCloseTo(2.8, 5);
    });

    it("quality=4 (good) leaves ease factor unchanged", () => {
        const result = sm2Review(DEFAULT_SRS_STATE, 4, new Date());
        expect(result.easeFactor).toBeCloseTo(2.5, 5);
    });

    it("quality=3 (hard) decreases ease factor by 0.14", () => {
        const result = sm2Review(DEFAULT_SRS_STATE, 3, new Date());
        expect(result.easeFactor).toBeCloseTo(2.36, 5);
    });

    it("quality<3 (again) resets repetitions and interval regardless of history", () => {
        const now = new Date("2026-01-02T00:00:00Z");
        let state = sm2Review(DEFAULT_SRS_STATE, 5, now);
        state = sm2Review(state, 5, now);
        state = sm2Review(state, 5, now); // repetitions=3, interval=16

        const result = sm2Review(state, 0, now);
        expect(result.repetitions).toBe(0);
        expect(result.intervalDays).toBe(1);
        // EF still decreases by the full -0.8 penalty even on reset
        expect(result.easeFactor).toBeCloseTo(2.8 - 0.8, 5);
    });

    it("ease factor never drops below the 1.3 floor", () => {
        let state = DEFAULT_SRS_STATE;
        const now = new Date();
        for (let i = 0; i < 10; i++) {
            state = sm2Review(state, 0, now);
        }
        expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
        expect(state.easeFactor).toBeCloseTo(1.3, 5);
    });

    it("QUALITY_BY_BUTTON maps the four UI buttons to the expected SM-2 quality values", () => {
        expect(QUALITY_BY_BUTTON.again).toBe(0);
        expect(QUALITY_BY_BUTTON.hard).toBe(3);
        expect(QUALITY_BY_BUTTON.good).toBe(4);
        expect(QUALITY_BY_BUTTON.easy).toBe(5);
    });
});
