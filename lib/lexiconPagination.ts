// Internal lexicon endpoints keep their array response. A page counts rows
// (lexeme + meaning), so multi-meaning lexemes cannot exceed the page limit.
export const LEXICON_DEFAULT_LIMIT = 50
export const LEXICON_MAX_LIMIT = 100

export class LexiconPaginationError extends Error {}

export function validateLexiconPagination(offset: number, limit: number): void {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new LexiconPaginationError("offset must be a non-negative safe integer")
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > LEXICON_MAX_LIMIT) {
    throw new LexiconPaginationError(`limit must be an integer between 1 and ${LEXICON_MAX_LIMIT}`)
  }
}

export function parseLexiconPagination(params: URLSearchParams): { offset: number; limit: number } {
  const read = (key: string, fallback: number): number => {
    const values = params.getAll(key)
    if (values.length === 0) return fallback
    if (values.length !== 1 || !/^\d+$/.test(values[0])) {
      throw new LexiconPaginationError(`${key} must be specified once as a decimal integer`)
    }
    return Number(values[0])
  }
  const offset = read("offset", 0)
  const limit = read("limit", LEXICON_DEFAULT_LIMIT)
  validateLexiconPagination(offset, limit)
  return { offset, limit }
}
