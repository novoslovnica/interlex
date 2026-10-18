import {beforeEach, describe, expect, it, vi} from "vitest"
const mocks = vi.hoisted(() => ({
    words: vi.fn(), meanings: vi.fn(), roots: vi.fn(), tokens: vi.fn(), config: vi.fn(),
    cache: vi.fn((fn: () => Promise<unknown>, _keys: string[], _options: {revalidate: number}) => fn),
}))
vi.mock("next/cache", () => ({unstable_cache: mocks.cache}))
vi.mock("@/lib/prisma", () => ({
    prismaData: {lexeme: {count: mocks.words}, meaning: {count: mocks.meanings}, morpheme: {count: mocks.roots}},
    // Deliberately no raw-query or sentence-count methods: rendering must not
    // fall back to scanning/grouping lemma frequencies on a cache miss.
    prismaCorpus: {corpusToken: {count: mocks.tokens}, corpusConfig: {findUnique: mocks.config}},
}))
import {loadMainStats} from "./stats"
beforeEach(() => {
    mocks.words.mockResolvedValue(10)
    mocks.meanings.mockResolvedValue(20)
    mocks.roots.mockResolvedValue(4)
    mocks.tokens.mockReset()
    mocks.tokens.mockResolvedValueOnce(100).mockResolvedValueOnce(75)
    mocks.config.mockResolvedValue({value: "1.15"})
})
describe("homepage statistics", () => {
    it("uses the saved Zipf coefficient, shared cache and public lexical counts", async () => {
        expect(await loadMainStats()).toEqual({words: 10, meanings: 20, roots: 4, totalTokens: 100, coverage: 75, zipfAlpha: 1.15})
        expect(mocks.words).toHaveBeenCalledWith({where: {isPublic: true}})
        expect(mocks.meanings).toHaveBeenCalledWith({where: {lexeme: {isPublic: true}}})
        expect(mocks.config).toHaveBeenCalledWith({where: {key: "zipf_alpha"}, select: {value: true}})
        expect(mocks.cache).toHaveBeenCalledWith(loadMainStats, ["homepage-public-stats-v2"], {revalidate: 300})
    })
    it.each([undefined, "", "  ", "NaN", "Infinity", "-1", "invalid"])("shows no coefficient instead of recalculating invalid value %s", async value => {
        mocks.config.mockResolvedValue(value === undefined ? null : {value})
        expect((await loadMainStats()).zipfAlpha).toBeNull()
    })
    it("handles an empty corpus without dividing by zero", async () => {
        mocks.tokens.mockReset().mockResolvedValue(0)
        expect((await loadMainStats()).coverage).toBe(0)
    })
    it("propagates errors rather than caching invented zero statistics", async () => {
        mocks.config.mockRejectedValueOnce(new Error("database unavailable"))
        await expect(loadMainStats()).rejects.toThrow("database unavailable")
    })
})
