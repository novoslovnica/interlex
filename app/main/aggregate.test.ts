import {beforeEach, describe, expect, it, vi} from "vitest"
const mocks = vi.hoisted(() => ({aggregate: vi.fn(), findFirst: vi.fn()}))
vi.mock("@/lib/prisma", () => ({prismaData: {lexeme: mocks}}))
import {getRandomWordWithTranslations} from "./aggregate"
const publicWord = {id: 1, value: "voda", pos: "NOUN", lexemeAllophones: [{value: "vòda"}], meanings: []}
beforeEach(() => { vi.clearAllMocks(); mocks.aggregate.mockResolvedValue({_max: {id: 10}}); mocks.findFirst.mockResolvedValue(publicWord) })
describe("public homepage random word", () => {
    it("scopes both the random id range and the selected word to public lexemes", async () => {
        expect(await getRandomWordWithTranslations()).toMatchObject({id: 1, isv: "vòda"})
        expect(mocks.aggregate).toHaveBeenCalledWith({where: {isPublic: true}, _max: {id: true}})
        expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({where: {isPublic: true, id: {gte: expect.any(Number)}}, orderBy: {id: "asc"}}))
    })
    it("keeps the fallback public if the selected range disappeared", async () => {
        mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(publicWord)
        expect(await getRandomWordWithTranslations()).toMatchObject({id: 1})
        expect(mocks.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({where: {isPublic: true, id: {gte: 0}}}))
    })
    it("returns null if no public words exist", async () => {
        mocks.aggregate.mockResolvedValue({_max: {id: null}})
        expect(await getRandomWordWithTranslations()).toBeNull()
        expect(mocks.findFirst).not.toHaveBeenCalled()
    })
    it("returns null if words were deleted before either selection", async () => {
        mocks.findFirst.mockResolvedValue(null)
        expect(await getRandomWordWithTranslations()).toBeNull()
    })
})
