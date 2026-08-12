import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findUnique = vi.fn();
const executeRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({
    prismaAuth: {
        apiKey: { findUnique: (...args: unknown[]) => findUnique(...args) },
        $executeRaw: (...args: unknown[]) => executeRaw(...args),
    },
}));

import { authenticatePublicApiRequest } from "./auth";

function requestWithAuth(headerValue: string | null): NextRequest {
    const headers: Record<string, string> = {};
    if (headerValue !== null) headers["authorization"] = headerValue;
    return new NextRequest("http://localhost/api/public/v1/words", { headers });
}

describe("authenticatePublicApiRequest", () => {
    beforeEach(() => {
        findUnique.mockReset();
        executeRaw.mockReset();
        executeRaw.mockResolvedValue(1);
    });

    it("returns missing_api_key when the Authorization header is absent", async () => {
        const result = await authenticatePublicApiRequest(requestWithAuth(null));
        expect(result).toEqual({ ok: false, status: 401, code: "missing_api_key" });
        expect(findUnique).not.toHaveBeenCalled();
    });

    it("returns missing_api_key when the header isn't a Bearer token", async () => {
        const result = await authenticatePublicApiRequest(requestWithAuth("Basic abc123"));
        expect(result).toEqual({ ok: false, status: 401, code: "missing_api_key" });
        expect(findUnique).not.toHaveBeenCalled();
    });

    it("short-circuits malformed tokens (wrong prefix) before any DB call", async () => {
        const result = await authenticatePublicApiRequest(requestWithAuth("Bearer not-an-islx-key"));
        expect(result).toEqual({ ok: false, status: 401, code: "invalid_api_key" });
        expect(findUnique).not.toHaveBeenCalled();
    });

    it("returns invalid_api_key when the hash isn't found in the DB", async () => {
        findUnique.mockResolvedValueOnce(null);
        const result = await authenticatePublicApiRequest(requestWithAuth("Bearer islx_doesnotexist"));
        expect(result).toEqual({ ok: false, status: 401, code: "invalid_api_key" });
    });

    it("returns revoked_api_key when the key has been revoked", async () => {
        findUnique.mockResolvedValueOnce({ id: "k1", userId: "u1", name: "test", revokedAt: new Date() });
        const result = await authenticatePublicApiRequest(requestWithAuth("Bearer islx_revoked"));
        expect(result).toEqual({ ok: false, status: 401, code: "revoked_api_key" });
    });

    it("returns ok:true with the key record for a valid, active key", async () => {
        findUnique.mockResolvedValueOnce({ id: "k1", userId: "u1", name: "test", revokedAt: null });
        const result = await authenticatePublicApiRequest(requestWithAuth("Bearer islx_valid"));
        expect(result).toEqual({ ok: true, key: { id: "k1", userId: "u1", name: "test" } });
    });

    it("still succeeds even if the fire-and-forget usage bump fails", async () => {
        findUnique.mockResolvedValueOnce({ id: "k1", userId: "u1", name: "test", revokedAt: null });
        executeRaw.mockRejectedValueOnce(new Error("db busy"));
        const result = await authenticatePublicApiRequest(requestWithAuth("Bearer islx_valid"));
        expect(result.ok).toBe(true);
    });
});
