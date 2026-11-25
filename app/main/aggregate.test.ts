import {beforeEach, describe, expect, it, vi} from "vitest"
const mocks = vi.hoisted(() => ({aggregate: vi.fn(), findFirst: vi.fn()}))
vi.mock("@/lib/prisma", () => ({prismaData: {lexeme: mocks}}))
import {getRandomWordWithTranslations} from "./aggregate"
const publicWord = {id: 1, value: "voda", pos: "NOUN", lexemeAllophones: [{value: "vòda"}], meanings: []}
const standardCore = {flavor: {code: "CORE"}, type: "standard", value: {not: ""}}
const eligibleWord = {isPublic: true, lexemeAllophones: {some: standardCore}}
beforeEach(() => { vi.clearAllMocks(); mocks.aggregate.mockResolvedValue({_max: {id: 10}}); mocks.findFirst.mockResolvedValue(publicWord) })
describe("public homepage random word", () => {
    it("uses the standard CORE spelling of a public word", async () => {
        mocks.findFirst.mockResolvedValue({ ...publicWord, id: 25508, value: "znacenje", lexemeAllophones: [{value: "značenje"}] })
        expect(await getRandomWordWithTranslations()).toMatchObject({id: 25508, isv: "značenje"})
        expect(mocks.aggregate).toHaveBeenCalledWith({where: eligibleWord, _max: {id: true}})
        expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {...eligibleWord, id: {gte: expect.any(Number)}},
            orderBy: {id: "asc"},
            select: expect.objectContaining({lexemeAllophones: expect.objectContaining({where: standardCore})}),
        }))
    })
    it("keeps the same eligibility criteria when the selected range disappeared", async () => {
        mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(publicWord)
        expect(await getRandomWordWithTranslations()).toMatchObject({id: 1})
        expect(mocks.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({where: {...eligibleWord, id: {gte: 0}}}))
    })
    it("never displays the search key if the standard form disappears during selection", async () => {
        mocks.findFirst.mockResolvedValue({...publicWord, lexemeAllophones: []})
        expect(await getRandomWordWithTranslations()).toBeNull()
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
