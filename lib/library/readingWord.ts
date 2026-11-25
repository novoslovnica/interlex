export const READING_WORD_PATTERN = /^\p{L}[\p{L}\p{M}]{0,79}$/u

export interface ReadingEntry {
    id: number
    word: string
    pos: string | null
    translations: string[]
    meanings: string[]
}

export interface ReadingResult {
    entries: ReadingEntry[]
    readings: string[]
    warmingUp: boolean
}
