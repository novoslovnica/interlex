// Правило согласия волонтёров. Чистая функция: одни и те же пороги для
// перевода сейчас и для следующих типов микрозадач потом.

export type Verdict = "yes" | "no" | "unknown"
export type CommunityStatus = "confirmed" | "rejected" | "disputed"

// Перевес в 3 (при весе 1 - три согласных ответа без возражений, либо
// 4 против 1 и т.д.). Порог - на разницу, а не на число "да": один голос
// против должен отодвигать решение, а не игнорироваться.
export const CONSENSUS_MARGIN = 3
// После стольких значимых ответов без перевеса дальше спрашивать волонтёров
// бессмысленно - это спорный случай, его решает модератор.
export const DISPUTE_VOTE_COUNT = 7

export interface Tally {
    yes: number       // сумма весов "верно"
    no: number        // сумма весов "неверно"
    decisive: number  // число ответов "верно"/"неверно"; "не знаю" сюда не входит
}

export function evaluateConsensus(tally: Tally): CommunityStatus | null {
    if (tally.yes - tally.no >= CONSENSUS_MARGIN) return "confirmed"
    if (tally.no - tally.yes >= CONSENSUS_MARGIN) return "rejected"
    if (tally.decisive >= DISPUTE_VOTE_COUNT) return "disputed"
    return null
}
