import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const count = vi.fn();
const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
    prismaLibrary: {
        libraryEntry: {
            findMany: (...args: unknown[]) => findMany(...args),
            count: (...args: unknown[]) => count(...args),
            findFirst: (...args: unknown[]) => findFirst(...args),
        },
    },
}));

import { searchPublicLibrary, getPublicLibraryEntryBySlug } from "./library";

describe("searchPublicLibrary", () => {
    beforeEach(() => {
        findMany.mockReset();
        count.mockReset();
    });

    it("always scopes to isPublic: true, with no search term", async () => {
        findMany.mockResolvedValueOnce([]);
        count.mockResolvedValueOnce(0);

        await searchPublicLibrary("", 25, 0);

        expect(findMany.mock.calls[0][0].where).toEqual({ isPublic: true });
        expect(count.mock.calls[0][0].where).toEqual({ isPublic: true });
    });

    it("adds a title/author OR filter on top of isPublic when searching", async () => {
        findMany.mockResolvedValueOnce([]);
        count.mockResolvedValueOnce(0);

        await searchPublicLibrary("princ", 25, 0);

        const where = findMany.mock.calls[0][0].where;
        expect(where.isPublic).toBe(true);
        expect(where.OR).toEqual([
            { title: { contains: "princ" } },
            { author: { contains: "princ" } },
        ]);
    });

    it("never selects body on the list query", async () => {
        findMany.mockResolvedValueOnce([]);
        count.mockResolvedValueOnce(0);

        await searchPublicLibrary("", 25, 0);

        expect(findMany.mock.calls[0][0].select).not.toHaveProperty("body");
        expect(findMany.mock.calls[0][0].select).not.toHaveProperty("addedById");
        expect(findMany.mock.calls[0][0].select).not.toHaveProperty("actionHistory");
    });

    it("passes limit/offset through as take/skip", async () => {
        findMany.mockResolvedValueOnce([]);
        count.mockResolvedValueOnce(0);

        await searchPublicLibrary("", 10, 20);

        expect(findMany.mock.calls[0][0].take).toBe(10);
        expect(findMany.mock.calls[0][0].skip).toBe(20);
    });
});

describe("getPublicLibraryEntryBySlug", () => {
    beforeEach(() => {
        findFirst.mockReset();
    });

    it("scopes to isPublic: true - a hidden entry with a matching slug returns null", async () => {
        findFirst.mockResolvedValueOnce(null);

        const result = await getPublicLibraryEntryBySlug("hidden-text");

        expect(result).toBeNull();
        expect(findFirst.mock.calls[0][0].where).toEqual({ slug: "hidden-text", isPublic: true });
    });

    it("selects body for the detail view (unlike the list query)", async () => {
        findFirst.mockResolvedValueOnce({ slug: "maly-princ", title: "Maly Princ", body: "..." });

        await getPublicLibraryEntryBySlug("maly-princ")

        expect(findFirst.mock.calls[0][0].select).toHaveProperty("body", true)
    });
});
