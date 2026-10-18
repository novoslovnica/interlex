import {describe, expect, it} from "vitest"
import {parseLexiconPagination, validateLexiconPagination, LexiconPaginationError} from "./lexiconPagination"

describe("lexicon pagination contract", () => {
  it("defaults to offset 0 and limit 50", () => {
    expect(parseLexiconPagination(new URLSearchParams())).toEqual({offset: 0, limit: 50})
    expect(parseLexiconPagination(new URLSearchParams("offset=2&limit=100"))).toEqual({offset: 2, limit: 100})
  })
  it.each(["-1", "1.5", "NaN", "Infinity", "1e2", "0x10", "", " ", "+1", "9007199254740992", "1 OR 1=1"])("rejects malformed offset %s", value => {
    expect(() => parseLexiconPagination(new URLSearchParams({offset: value}))).toThrow(LexiconPaginationError)
  })
  it.each(["0", "-1", "101", "999999", "1.5", "NaN", "Infinity", "", "1e2", " 10"])("rejects invalid limit %s", value => {
    expect(() => parseLexiconPagination(new URLSearchParams({limit: value}))).toThrow(LexiconPaginationError)
  })
  it("rejects repeated parameters", () => {
    expect(() => parseLexiconPagination(new URLSearchParams("limit=10&limit=20"))).toThrow()
    expect(() => parseLexiconPagination(new URLSearchParams("offset=0&offset=1"))).toThrow()
  })
  it("validates direct service callers as well", () => {
    for (const [offset, limit] of [[-1, 10], [0, -1], [0, 101], [0, NaN], [Infinity, 10], [0, 1.5]]) {
      expect(() => validateLexiconPagination(offset, limit)).toThrow(LexiconPaginationError)
    }
  })
})
