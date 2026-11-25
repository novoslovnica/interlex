import { READING_WORD_PATTERN } from "./readingWord"

export const READING_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const
export type ReadingLevel = (typeof READING_LEVELS)[number]
export type ReadingWordLevels = Record<string, ReadingLevel>

const MAX_HIGHLIGHT_TEXT_LENGTH = 3500

export function supportsReadingHighlights(level: string | null, content: string): boolean {
    return (level === "A1" || level === "A2") && content.length > 0 && content.length <= MAX_HIGHLIGHT_TEXT_LENGTH
}

export function readingWordKey(word: string): string {
    return word.normalize("NFC").toLowerCase()
}

export function knownReadingLevel(value?: string | null): ReadingLevel | undefined {
    return READING_LEVELS.find(level => level === value)
}

export function highlightLevel(word: string, levels: ReadingWordLevels, threshold?: ReadingLevel): ReadingLevel | undefined {
    if (!threshold || !READING_WORD_PATTERN.test(word.normalize("NFC"))) return undefined
    const level = knownReadingLevel(levels[readingWordKey(word)])
    return level && READING_LEVELS.indexOf(level) > READING_LEVELS.indexOf(threshold) ? level : undefined
}
