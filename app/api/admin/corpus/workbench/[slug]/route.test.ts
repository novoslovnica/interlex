import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { WorkbenchConflict } from "@/lib/corpus/workbench"
const mocks = vi.hoisted(() => ({ auth: vi.fn(), permission: vi.fn(), detail: vi.fn(), queue: vi.fn(), history: vi.fn(), save: vi.fn(), undo: vi.fn(), lexeme: vi.fn() }))
vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/permissions", () => ({ checkPermission: mocks.permission }))
vi.mock("@/lib/slug", () => ({ decodeSlugParam: decodeURIComponent }))
vi.mock("@/lib/prisma", () => ({ prismaData: { lexeme: { findUnique: mocks.lexeme } } }))
vi.mock("@/lib/corpus/homonymReview", () => ({ withHomonymReviewDb: (fn: (db: unknown) => unknown) => fn({}) }))
vi.mock("@/lib/corpus/workbench", async (original) => ({ ...await original<typeof import("@/lib/corpus/workbench")>(), tokenDetail: mocks.detail, tokenQueue: mocks.queue, listTokenEdits: mocks.history, saveTokenEdit: mocks.save, undoTokenEdit: mocks.undo }))
import { GET, POST } from "./route"
const ctx = { params: Promise.resolve({ slug: "d%C5%BE" }) }
const req = (query = "") => new NextRequest(`http://localhost/api/admin/corpus/workbench/doc${query}`)
const post = (body: unknown) => new NextRequest("http://localhost/api/admin/corpus/workbench/doc", { method: "POST", body: JSON.stringify(body) })
const revision = "a".repeat(64)
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: "mod", role: "MODERATOR", email: "mod@example.org" } })
  mocks.permission.mockResolvedValue(true)
  mocks.queue.mockReturnValue({ tokens: [], more: false })
  mocks.history.mockReturnValue([])
  mocks.detail.mockReturnValue({ revision })
  mocks.save.mockReturnValue({ editId: "edit" })
})
describe("workbench API authorization and validation", () => {
  it("requires the specific feature on every read, save and undo", async () => {
    for (const session of [null, { user: { id: "user", role: "USER" } }]) {
      mocks.auth.mockResolvedValue(session); mocks.permission.mockResolvedValue(false)
      expect((await GET(req(), ctx)).status).toBe(403)
      expect((await GET(req("?view=history"), ctx)).status).toBe(403)
      expect((await POST(post({ tokenId: "1", revision, candidateId: 1 }), ctx)).status).toBe(403)
      expect((await POST(post({ action: "undo", editId: "a".repeat(36) }), ctx)).status).toBe(403)
    }
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.undo).not.toHaveBeenCalled(); expect(mocks.queue).not.toHaveBeenCalled()
  })
  it("validates cursors, filters, body and revision before touching the DB", async () => {
    for (const query of ["?token=-1", "?cursor=9223372036854775808", "?filter=other", "?direction=back", "?q=" + "x".repeat(121)]) expect((await GET(req(query), ctx)).status).toBe(400)
    for (const body of [null, { tokenId: "1", candidateId: 1 }, { tokenId: "1", revision, candidateId: 1.5 }, { tokenId: "1", revision, wordSlug: "x", feats: [] }]) expect((await POST(post(body), ctx)).status).toBe(400)
    expect((await POST(new NextRequest("http://localhost", { method: "POST", body: "broken" }), ctx)).status).toBe(400)
    expect((await POST(post({ text: "x".repeat(16001) }), ctx)).status).toBe(413)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it("uses no-store responses, decoded document slug and returns 404 for missing tokens", async () => {
    const response = await GET(req("?token=1"), ctx)
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(mocks.detail).toHaveBeenCalledWith({}, "dž", "1")
    mocks.detail.mockReturnValue(null)
    expect((await GET(req("?token=1"), ctx)).status).toBe(404)
  })
  it("maps revision conflicts to 409 without retrying or falling back to the old writer", async () => {
    mocks.save.mockImplementation(() => { throw new WorkbenchConflict("Changed") })
    expect((await POST(post({ tokenId: "1", revision, candidateId: 1 }), ctx)).status).toBe(409)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ slug: "dž", tokenId: "1", revision, user: { id: "mod" } })
  })
  it("checks manual dictionary choices in the lexical DB before saving into the corpus", async () => {
    const body = { tokenId: "1", revision, wordSlug: "new-NOUN", feats: { case: "nom" } }
    mocks.lexeme.mockResolvedValue(null)
    expect((await POST(post(body), ctx)).status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
    mocks.lexeme.mockResolvedValue({ slug: "new-NOUN", value: "new", pos: "noun" })
    expect((await POST(post(body), ctx)).status).toBe(200)
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ manualLexeme: { slug: "new-NOUN", lemma: "new", pos: "NOUN" } })
  })
  it("returns conflict for a blocked undo", async () => {
    mocks.undo.mockReturnValue({ restored: false, conflict: true })
    expect((await POST(post({ action: "undo", editId: "a".repeat(36) }), ctx)).status).toBe(409)
  })
})
