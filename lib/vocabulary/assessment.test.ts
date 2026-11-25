import { describe, expect, it } from "vitest"
import { recommendVocabularyLevel, VOCABULARY_LEVELS, type VocabularyQuestion } from "./assessment"

const questions: VocabularyQuestion[] = VOCABULARY_LEVELS.flatMap(level =>
    Array.from({ length: 4 }, () => ({ word: "test", level, options: ["one", "two"], correctIndex: 0 })),
)

describe("vocabulary recommendation", () => {
    it("requires correct answers in each preceding group before recommending the next level", () => {
        const answers = [0, 0, -1, 1, 0, 0, 0, 0, 0, 0, 0, 0]
        expect(recommendVocabularyLevel(questions, answers)).toEqual({ level: "A1", scores: { A1: 2, A2: 4, B1: 4 }, correct: 10 })
    })

    it("recommends the highest consecutive group with three correct answers or more", () => {
        expect(recommendVocabularyLevel(questions, [0, 0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 1]).level).toBe("A2")
        expect(recommendVocabularyLevel(questions, [0, 0, 0, -1, 0, 0, 0, 1, 0, 0, 0, 1]).level).toBe("B1")
    })
})
