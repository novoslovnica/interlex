// Вес голоса участника. Чистая функция от накопленной статистики - одна
// формула и для приёма голоса, и для полной пересборки.

export interface ContributorEvidence {
    votesResolved: number   // ответы, по которым уже есть итог (согласие или модератор)
    votesAgreed: number     // из них совпали с итогом
    controlTotal: number    // ответы "верно"/"неверно" на контрольных карточках
    controlCorrect: number
}

export interface Reputation {
    accuracy: number | null // null - судить пока не по чему
    weight: number
    flagged: boolean
}

// До стольких оценённых ответов все равны: на малой выборке точность - шум.
export const MIN_EVIDENCE = 20
// Контрольные карточки - единственный сигнал с заранее известным ответом,
// поэтому провал именно на них (а не общая низкая точность, которая может
// быть честным расхождением с большинством) обнуляет вес и зовёт модератора.
export const CONTROL_FLAG_MIN = 10
export const CONTROL_FLAG_ACCURACY = 0.5

export function computeReputation(evidence: ContributorEvidence): Reputation {
    const judged = evidence.votesResolved + evidence.controlTotal
    const correct = evidence.votesAgreed + evidence.controlCorrect
    const accuracy = judged > 0 ? correct / judged : null

    if (evidence.controlTotal >= CONTROL_FLAG_MIN && evidence.controlCorrect / evidence.controlTotal < CONTROL_FLAG_ACCURACY) {
        return { accuracy, weight: 0, flagged: true }
    }
    if (judged < MIN_EVIDENCE || accuracy === null) return { accuracy, weight: 1, flagged: false }

    let weight = 2
    if (accuracy < 0.6) weight = 0.25
    else if (accuracy < 0.8) weight = 1
    else if (accuracy < 0.9) weight = 1.5
    return { accuracy, weight, flagged: false }
}
