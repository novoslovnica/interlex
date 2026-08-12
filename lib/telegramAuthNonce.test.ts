import { describe, it, expect, vi, beforeEach } from "vitest";

const executeRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
    prismaAuth: {
        $executeRaw: (...args: unknown[]) => executeRaw(...args),
    },
}));

import { claimTelegramAuthHash } from "./telegramAuthNonce";

describe("claimTelegramAuthHash", () => {
    beforeEach(() => {
        executeRaw.mockReset();
    });

    it("claims a hash that hasn't been used before and sweeps stale rows", async () => {
        executeRaw
            .mockResolvedValueOnce(1) // INSERT OR IGNORE affected 1 row -> claimed
            .mockResolvedValueOnce(0); // DELETE cleanup

        const result = await claimTelegramAuthHash("hash-abc", 1000, 2000);

        expect(result).toBe(true);
        expect(executeRaw).toHaveBeenCalledTimes(2);
    });

    it("rejects a hash that was already claimed (replay) without running cleanup", async () => {
        executeRaw.mockResolvedValueOnce(0); // INSERT OR IGNORE affected 0 rows -> already claimed

        const result = await claimTelegramAuthHash("hash-abc", 1000, 2000);

        expect(result).toBe(false);
        expect(executeRaw).toHaveBeenCalledTimes(1);
    });
});
