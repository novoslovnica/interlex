import { init } from "@/lib/sqlite"
import { VOCABULARY_LEVELS, type QuizLanguage, type VocabularyLevel, type VocabularyQuestion } from "./assessment"

// Pin the reviewed questions by meaning and level. Recomputing corpus
// frequencies can reclassify lexemes without changing this pilot deck.
const meaningIdsByLevel: Record<VocabularyLevel, readonly number[]> = {
    A1: [19764, 11604, 8323, 6231],
    A2: [5687, 17146, 9666, 12277],
    B1: [12614, 14162, 8495, 13041],
}

type BankRow = { meaningId: number; word: string; translation: string | null }

export async function loadVocabularyQuestions(language: QuizLanguage): Promise<VocabularyQuestion[]> {
    const db = await init()
    const meaningIds = VOCABULARY_LEVELS.flatMap(level => meaningIdsByLevel[level])
    try {
        const rows = db.prepare<[string, ...number[]], BankRow>(`
            SELECT m.id AS meaningId, a.value AS word,
                (SELECT trim(t.value) FROM translations t
                 WHERE t.meaningId = m.id AND t.language = ? AND t.verified = 1 AND trim(t.value) <> ''
                 ORDER BY t.id LIMIT 1) AS translation
            FROM meanings m JOIN lexemes l ON l.id = m.lexemeId
            JOIN lexeme_allophones a ON a.lexemeId = l.id AND a.type = 'standard'
                 AND a.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
            WHERE l.isPublic = 1 AND trim(a.value) <> '' AND m.id IN (${meaningIds.map(() => "?").join(",")})
        `).all(language, ...meaningIds)
        const byMeaning = new Map(rows.map(row => [row.meaningId, row]))
        const questions: VocabularyQuestion[] = []
        for (const [groupIndex, level] of VOCABULARY_LEVELS.entries()) {
            const entries = meaningIdsByLevel[level].map(id => byMeaning.get(id))
            const available = entries.filter((entry): entry is BankRow & { translation: string } => !!entry?.translation)
            if (available.length !== 4 || new Set(available.map(entry => entry.translation.toLowerCase())).size !== 4) return []
            for (const [index, entry] of available.entries()) {
                const options = available.filter(candidate => candidate !== entry).map(candidate => candidate.translation)
                const correctIndex = (index * 3 + groupIndex + 1) % 4
                options.splice(correctIndex, 0, entry.translation)
                questions.push({ word: entry.word, level, options, correctIndex })
            }
        }
        return questions
    } finally {
        db.close()
    }
}
