import { describe, it, expect } from "vitest"
import { validateHandle, normalizeHandle } from "./handle"

describe("validateHandle", () => {
    it("accepts a plain handle and lowercases it", () => {
        expect(validateHandle("  Ivan_92 ")).toEqual({ ok: true, handle: "ivan_92" })
    })

    it("rejects by length", () => {
        expect(validateHandle("ab")).toEqual({ ok: false, error: "too_short" })
        expect(validateHandle("a".repeat(31))).toEqual({ ok: false, error: "too_long" })
    })

    it("rejects characters outside a-z0-9_- and edge separators", () => {
        expect(validateHandle("иван")).toEqual({ ok: false, error: "invalid_chars" })
        expect(validateHandle("ivan petrov")).toEqual({ ok: false, error: "invalid_chars" })
        expect(validateHandle("-ivan")).toEqual({ ok: false, error: "invalid_chars" })
        expect(validateHandle("ivan_")).toEqual({ ok: false, error: "invalid_chars" })
        expect(validateHandle("ivan@telegram.user")).toEqual({ ok: false, error: "invalid_chars" })
    })

    it("rejects reserved names regardless of case", () => {
        expect(validateHandle("Admin")).toEqual({ ok: false, error: "reserved" })
        expect(validateHandle("community")).toEqual({ ok: false, error: "reserved" })
    })
})

describe("normalizeHandle", () => {
    it("trims and lowercases", () => {
        expect(normalizeHandle(" MiXed ")).toBe("mixed")
    })
})
