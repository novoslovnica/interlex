import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const count = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
    prismaAuth: {
        apiKey: {
            findMany: (...args: unknown[]) => findMany(...args),
            count: (...args: unknown[]) => count(...args),
            create: (...args: unknown[]) => create(...args),
            updateMany: (...args: unknown[]) => updateMany(...args),
        },
    },
}));

import { listApiKeysForUser, createApiKeyForUser, revokeApiKeyForUser } from "./apiKeys";
import { hashApiKey } from "./apiKeyCrypto";

describe("listApiKeysForUser", () => {
    it("never selects keyHash", async () => {
        findMany.mockResolvedValueOnce([]);
        await listApiKeysForUser("u1");
        const args = findMany.mock.calls[0][0];
        expect(args.select).not.toHaveProperty("keyHash");
        expect(args.where).toEqual({ userId: "u1" });
    });
});

describe("createApiKeyForUser", () => {
    beforeEach(() => {
        count.mockReset();
        create.mockReset();
    });

    it("rejects an empty/whitespace-only name without touching the DB", async () => {
        const result = await createApiKeyForUser("u1", "   ");
        expect(result).toEqual({ error: "invalid_name" });
        expect(create).not.toHaveBeenCalled();
    });

    it("rejects when the active-key limit is reached", async () => {
        count.mockResolvedValueOnce(20);
        const result = await createApiKeyForUser("u1", "my script");
        expect(result).toEqual({ error: "limit_reached" });
        expect(create).not.toHaveBeenCalled();
    });

    it("generates a raw key whose hash round-trips to what gets persisted, and returns it only once", async () => {
        count.mockResolvedValueOnce(0);
        create.mockImplementationOnce(async ({ data }: { data: { name: string; keyPrefix: string } }) => ({
            id: "k1",
            name: data.name,
            keyPrefix: data.keyPrefix,
            lastUsedAt: null,
            requestCount: 0,
            createdAt: new Date(),
            revokedAt: null,
        }));

        const result = await createApiKeyForUser("u1", "my script");
        expect("rawKey" in result).toBe(true);
        if (!("rawKey" in result)) throw new Error("expected success");

        expect(result.rawKey.startsWith("islx_")).toBe(true);
        const persistedArgs = create.mock.calls[0][0];
        expect(persistedArgs.data.keyHash).toBe(hashApiKey(result.rawKey));
        // The returned summary never carries the hash itself.
        expect(result).not.toHaveProperty("keyHash");
    });
});

describe("revokeApiKeyForUser", () => {
    it("scopes the update by both id and userId, so a guessed id can't revoke another user's key", async () => {
        updateMany.mockResolvedValueOnce({ count: 1 });
        const result = await revokeApiKeyForUser("u1", "k1");
        expect(result).toBe(true);
        const args = updateMany.mock.calls[0][0];
        expect(args.where).toEqual({ id: "k1", userId: "u1", revokedAt: null });
    });

    it("returns false when nothing matched (not found, not owned, or already revoked)", async () => {
        updateMany.mockResolvedValueOnce({ count: 0 });
        const result = await revokeApiKeyForUser("u1", "not-mine");
        expect(result).toBe(false);
    });
});
