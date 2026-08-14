import { levenshtein } from "@/lib/levenshtein"

export interface ReflexCandidate {
    lexemeId: number
    candidate: string
    method: "proto_bridge" | "phonetic_heuristic"
    pos: string | null
}

export interface MatchResult {
    lexemeId: number
    method: "proto_bridge" | "phonetic_heuristic"
    confidence: number
    matchedCandidate: string
    pos: string | null
}

// Пороги подобраны консервативно осознанно: ложное авто-связывание хуже, чем
// его отсутствие (см. обсуждение в AGENTS.md "Historical Corpora" — ошибка
// матчера прикрепляет к лексеме неверную историческую цитату, это хуже, чем
// просто отсутствие фичи). auto_confirmed — только на очень близких формах,
// остальное уходит на ручное review модератора.
// Поднято с 0.85 до 0.90 после ревью реальных срабатываний: даже на словах
// нормальной длины попадались ложные совпадения (poslati/posvętiti,
// korova/kravata — случайное сходство корней после трансформаций).
export const AUTO_CONFIRM_THRESHOLD = 0.9
export const PROPOSE_THRESHOLD = 0.6

// Относительное сходство Левенштейна ненадёжно на коротких строках: "же"/"žeti"
// (2-4 символа) даёт 100% схожести при одной случайной вставке, хотя это
// совершенно не связанные слова. Ниже этой длины авто-подтверждение запрещено
// в принципе — запись всё равно уходит в proposed на ручное ревью, просто не
// минуя его.
export const MIN_LENGTH_FOR_AUTO_CONFIRM = 4

function similarity(a: string, b: string): number {
    if (!a || !b) return 0
    const maxLen = Math.max(a.length, b.length)
    if (maxLen === 0) return 1
    return 1 - levenshtein(a, b) / maxLen
}

/**
 * Находит лучшее совпадение исторической леммы среди набора кандидатов-рефлексов
 * (уже сгенерированных ветвевыми правилами для каждой лексемы). Берёт максимум
 * по всем кандидатам одной лексемы; если у нескольких лексем близкий скор —
 * возвращает первую по списку (без явного tie-break, порядок кандидатов задаёт вызывающий код).
 * POS здесь не фильтрует кандидатов — только переносится в результат, чтобы
 * statusForConfidence могла ограничить auto_confirm при несовпадении.
 */
export function findBestMatch(historicalLemma: string, candidates: ReflexCandidate[]): MatchResult | null {
    let best: MatchResult | null = null
    for (const c of candidates) {
        const conf = similarity(historicalLemma, c.candidate)
        if (conf < PROPOSE_THRESHOLD) continue
        if (!best || conf > best.confidence) {
            best = { lexemeId: c.lexemeId, method: c.method, confidence: conf, matchedCandidate: c.candidate, pos: c.pos }
        }
    }
    return best
}

// POS-гейт: сверяем UPOS историч. токена с Lexeme.pos перед авто-подтверждением
// (тот же набор тегов, что и в Universal Dependencies — Lexeme.pos хранится
// один-в-один с UD UPOS в этом проекте, см. config пример "VERB"/"NOUN"/...).
// null с любой стороны (POS не размечен) не блокирует — недостаточно сигнала,
// чтобы отклонять, но и недостаточно, чтобы подтверждать самостоятельно.
function posCompatible(historicalUpos: string | null, lexemePos: string | null): boolean {
    if (!historicalUpos || !lexemePos) return true
    return historicalUpos === lexemePos
}

export function statusForConfidence(
    confidence: number,
    matchedLemmaLength: number,
    historicalUpos: string | null,
    lexemePos: string | null,
): "auto_confirmed" | "proposed" {
    if (matchedLemmaLength < MIN_LENGTH_FOR_AUTO_CONFIRM) return "proposed"
    if (!posCompatible(historicalUpos, lexemePos)) return "proposed"
    return confidence >= AUTO_CONFIRM_THRESHOLD ? "auto_confirmed" : "proposed"
}
