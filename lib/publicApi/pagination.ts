// Shared pagination clamping for every app/api/public/v1/** list endpoint.
// Extracted from lib/publicApi/words.ts (roadmap #38) once a third consumer
// (library) needed the exact same clamping - words/proto now re-export from
// here rather than duplicating it.
export const PUBLIC_API_DEFAULT_LIMIT = 25
export const PUBLIC_API_MAX_LIMIT = 100

export function clampLimit(limit: number | null | undefined): number {
    if (limit == null || !Number.isFinite(limit) || limit <= 0) return PUBLIC_API_DEFAULT_LIMIT
    return Math.min(Math.floor(limit), PUBLIC_API_MAX_LIMIT)
}

export function clampOffset(offset: number | null | undefined): number {
    if (offset == null || !Number.isFinite(offset) || offset < 0) return 0
    return Math.floor(offset)
}
