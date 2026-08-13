import { describe, it, expect } from "vitest";
import { clampLimit, clampOffset } from "./pagination";

describe("clampLimit / clampOffset", () => {
    it("defaults and clamps limit to [1, 100]", () => {
        expect(clampLimit(undefined)).toBe(25);
        expect(clampLimit(NaN)).toBe(25);
        expect(clampLimit(0)).toBe(25);
        expect(clampLimit(-5)).toBe(25);
        expect(clampLimit(50)).toBe(50);
        expect(clampLimit(500)).toBe(100);
    });

    it("defaults offset to 0 and rejects negatives", () => {
        expect(clampOffset(undefined)).toBe(0);
        expect(clampOffset(-1)).toBe(0);
        expect(clampOffset(10)).toBe(10);
    });
});
