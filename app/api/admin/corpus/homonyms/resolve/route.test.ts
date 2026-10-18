import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ auth: vi.fn(), permission: vi.fn(), db: vi.fn() }))
vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/permissions", () => ({ checkPermission: mocks.permission }))
vi.mock("@/lib/corpus/homonymReview", async (original) => ({
  ...await original<typeof import("@/lib/corpus/homonymReview")>(),
  withHomonymReviewDb: mocks.db,
}))
import { POST } from "./route"
import { GET as batches, POST as undo } from "../batches/route"
import { HomonymReviewConflict } from "@/lib/corpus/homonymReview"

const request = (body: unknown) => new NextRequest("https://example.org/api/admin/corpus/homonyms/resolve", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
})
const selection = { groupKey: "group", wordSlug: "word", tokens: [{ tokenId: "1", revision: "a".repeat(64) }] }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "moderator", role: "MODERATOR" } })
  mocks.permission.mockResolvedValue(true)
})
describe("homonym review API boundaries", () => {
  it("refuses the old group-wide request without touching corpus.db", async () => {
    expect((await POST(request({ groupKey: "group", wordSlug: "word" }))).status).toBe(400)
    expect(mocks.db).not.toHaveBeenCalled()
  })
  it("requires the specific permission for applying and undoing batches and reading history", async () => {
    mocks.permission.mockResolvedValue(false)
    expect((await POST(request(selection))).status).toBe(403)
    expect((await undo(request({ batchId: "batch" }))).status).toBe(403)
    expect((await batches()).status).toBe(403)
    expect(mocks.db).not.toHaveBeenCalled()
  })
  it("rejects unauthenticated requests", async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await POST(request(selection))).status).toBe(403)
    expect(mocks.db).not.toHaveBeenCalled()
  })
  it("accepts explicitly scoped selections and returns the durable batch id", async () => {
    mocks.db.mockReturnValue({ batchId: "batch", resolvedTokens: 1 })
    const response = await POST(request(selection))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, batchId: "batch", resolvedTokens: 1 })
  })
  it("reports stale selections as conflict", async () => {
    mocks.db.mockImplementation(() => { throw new HomonymReviewConflict("stale") })
    expect((await POST(request(selection))).status).toBe(409)
  })
})
