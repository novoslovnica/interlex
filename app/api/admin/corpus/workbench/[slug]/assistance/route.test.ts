import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { Feature } from "@/config/features"
import { WorkbenchConflict } from "@/lib/corpus/workbench"
const m = vi.hoisted(() => ({ auth: vi.fn(), permission: vi.fn(), assistance: vi.fn(), accept: vi.fn(), tasks: vi.fn(), defer: vi.fn(), close: vi.fn() }))
vi.mock("@/auth", () => ({ auth: m.auth }))
vi.mock("@/lib/permissions", () => ({ checkPermission: m.permission }))
vi.mock("@/lib/slug", () => ({ decodeSlugParam: decodeURIComponent }))
vi.mock("@/lib/corpus/workbenchAutomation", () => ({ assistance: m.assistance, acceptRecommendation: m.accept, taskList: m.tasks, deferTask: m.defer, closeTask: m.close }))
vi.mock("@/lib/corpus/homonymReview", () => ({ withHomonymReviewDb: (fn: (db: unknown) => unknown) => fn({ transaction: (work: () => unknown) => work, prepare: () => ({ get: () => undefined }) }) }))
import { GET, POST } from "./route"
const ctx = { params: Promise.resolve({ slug: "d%C5%BE" }) }
const rev = "a".repeat(64)
const get = (query = "") => new NextRequest(`http://localhost/assistance${query}`)
const post = (body: unknown) => new NextRequest("http://localhost/assistance", { method: "POST", body: JSON.stringify(body) })
const deferred = { action: "defer", tokenId: "1", revision: rev, taskVersion: null, reason: "consultation", note: "Проверить" }
beforeEach(() => {
  vi.resetAllMocks()
  m.auth.mockResolvedValue({ user: { id: "editor", role: "MODERATOR", email: "editor@example.test" } })
  m.permission.mockImplementation(async (_session: unknown, feature: Feature) => feature === Feature.CorpusTokenDisambiguate)
  m.tasks.mockReturnValue([]); m.assistance.mockReturnValue({ similar: [], recommendation: null }); m.defer.mockReturnValue({ id: "task" }); m.accept.mockReturnValue({ editId: "edit" })
})
describe("editor assistance API", () => {
  it("requires the corpus feature and an identifiable user for every action", async () => {
    for (const session of [null, { user: { role: "ADMIN" } }]) {
      m.auth.mockResolvedValue(session)
      expect((await GET(get("?token=1"), ctx)).status).toBe(403)
      expect((await POST(post(deferred), ctx)).status).toBe(403)
    }
    m.auth.mockResolvedValue({ user: { id: "ordinary" } }); m.permission.mockResolvedValue(false)
    expect((await GET(get("?view=tasks"), ctx)).status).toBe(403)
    expect((await POST(post({ action: "close", taskId: "a".repeat(36), version: "b".repeat(36) }), ctx)).status).toBe(403)
    expect(m.assistance).not.toHaveBeenCalled(); expect(m.defer).not.toHaveBeenCalled()
  })
  it("checks the additional candidate-review feature without blocking ordinary deferral", async () => {
    expect((await POST(post(deferred), ctx)).status).toBe(200)
    expect((await POST(post({ ...deferred, reason: "missing_lexeme", proposal: { value: "new", pos: "NOUN" } }), ctx)).status).toBe(403)
    expect(m.defer).toHaveBeenCalledTimes(1)
    m.permission.mockResolvedValue(true)
    expect((await POST(post({ ...deferred, reason: "missing_lexeme", proposal: { value: "new", pos: "NOUN" } }), ctx)).status).toBe(200)
  })
  it("derives task ownership exclusively from the session and disables caching", async () => {
    const response = await GET(get("?view=tasks&token=1&userId=other"), ctx)
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(m.tasks.mock.calls[0].slice(1)).toEqual(["dž", "editor"])
    expect((await response.json()).canPropose).toBe(false)
    await POST(post({ ...deferred, userId: "other" }), ctx)
    expect(m.defer.mock.calls[0].slice(1, 3)).toEqual(["dž", "editor"])
  })
  it("requires both target and recommendation revisions for one-click confirmation", async () => {
    expect((await POST(post({ action: "accept", tokenId: "1", revision: rev, candidateId: 2 }), ctx)).status).toBe(400)
    expect((await POST(post({ action: "accept", tokenId: "1", revision: rev, recommendationRevision: rev, candidateId: 2 }), ctx)).status).toBe(200)
    expect(m.accept.mock.calls[0][1]).toMatchObject({ slug: "dž", tokenId: "1", revision: rev, recommendationRevision: rev, user: { id: "editor" } })
    m.accept.mockImplementation(() => { throw new WorkbenchConflict("Evidence changed") })
    expect((await POST(post({ action: "accept", tokenId: "1", revision: rev, recommendationRevision: rev, candidateId: 2 }), ctx)).status).toBe(409)
  })
  it("rejects invalid ids, cursors, reasons, stale-version formats and oversized input", async () => {
    for (const query of ["?token=-1", "?token=1&cursor=9223372036854775808", "?view=tasks&token=invalid"]) expect((await GET(get(query), ctx)).status).toBe(400)
    for (const b of [null, { ...deferred, reason: "__proto__" }, { ...deferred, taskVersion: "invalid" }, { ...deferred, note: 123 }, { ...deferred, revision: "old" }]) expect((await POST(post(b), ctx)).status).toBe(400)
    expect((await POST(post({ text: "x".repeat(12001) }), ctx)).status).toBe(413)
    expect(m.defer).not.toHaveBeenCalled()
  })
})
