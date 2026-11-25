export const VOCABULARY_LEVELS = ["A1", "A2", "B1"] as const
export type VocabularyLevel = (typeof VOCABULARY_LEVELS)[number]
export type QuizLanguage = "ru" | "en"

export interface VocabularyQuestion {
    word: string
    level: VocabularyLevel
    options: string[]
    correctIndex: number
}

export function recommendVocabularyLevel(questions: readonly VocabularyQuestion[], choices: readonly number[]) {
    const scores: Record<VocabularyLevel, number> = { A1: 0, A2: 0, B1: 0 }
    questions.forEach((question, index) => {
        if (choices[index] === question.correctIndex) scores[question.level]++
    })
    // Advance only through consecutive groups with at least 3/4 correct.
    let level: VocabularyLevel = "A1"
    for (const candidate of VOCABULARY_LEVELS) {
        if (scores[candidate] < 3) break
        level = candidate
    }
    return { level, scores, correct: scores.A1 + scores.A2 + scores.B1 }
}
