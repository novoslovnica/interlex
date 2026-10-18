import { beforeEach, expect, it, vi } from "vitest"
const databases = vi.hoisted(() => Array.from({ length: 5 }, () => ({ $queryRaw: vi.fn() })))
vi.mock("@/lib/prisma", () => ({
    prismaAuth: databases[0], prismaData: databases[1], prismaLibrary: databases[2],
    prismaCorpus: databases[3], prismaHistorical: databases[4],
}))
import { GET } from "./route"
beforeEach(() => {
    vi.stubEnv("RELEASE_COMMIT", "expected-release")
    for (const db of databases) db.$queryRaw.mockReset().mockResolvedValue([])
})
it("identifies the release only when all five databases are available, without cache", async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok", release: "expected-release" })
    expect(response.headers.get("cache-control")).toBe("no-store")
    for (const db of databases) expect(db.$queryRaw).toHaveBeenCalledOnce()
})
it("returns 503 without database details when a database fails", async () => {
    databases[3].$queryRaw.mockRejectedValue(new Error("private database path"))
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: "unavailable" })
})
