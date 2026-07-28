import { MorphoCandidate } from './types';

// Слабее жёсткого управления предлога (GOVERNMENT_BONUS = 1_000_000 в
// dbAnalyzer.ts — почти грамматическое правило), но сильно доминирует над
// чистой частотностью (Lexeme.corpusFrequencyPerMln обычно < 5000) — флавор
// документа сильный, но не абсолютный сигнал: government, если сработал,
// должен побеждать всегда.
const FLAVOR_BONUS = 10_000;

/**
 * Флавор-приоритет документа (план разрешения омонимии, Фаза 3): если
 * однозначные (matchCount===1) слова документа явно тяготеют к одному
 * не-CORE флавору (EAST/WEST/SOUTH/NSL/...), омонимы того же документа
 * получают бонус к кандидатам этого флавора и переранжируются. При
 * отсутствии дискернируемого флавора (документ целиком CORE, либо совсем
 * нет однозначных слов) — no-op, ничего не трогает.
 *
 * Функция не завязана на конкретную форму T (CorpusTokenInput в
 * tokenizer.ts и внутренний TokenUpdate в reanalyzeDocument.ts — две разные
 * формы с одним и тем же набором кандидатов) — доступ к полям через
 * колбэки вместо общего интерфейса.
 */
export function applyDocumentFlavorBias<T>(
    items: T[],
    getCandidates: (item: T) => MorphoCandidate[],
    getMatchCount: (item: T) => number,
    applyWinner: (item: T, winner: MorphoCandidate) => void,
): void {
    const tally = new Map<string, number>();
    for (const item of items) {
        const candidates = getCandidates(item);
        if (getMatchCount(item) === 1 && candidates.length === 1) {
            const flavor = candidates[0].flavor ?? 'CORE';
            tally.set(flavor, (tally.get(flavor) ?? 0) + 1);
        }
    }

    let dominant: string | null = null;
    let dominantCount = 0;
    for (const [flavor, count] of tally) {
        if (flavor !== 'CORE' && count > dominantCount) {
            dominant = flavor;
            dominantCount = count;
        }
    }
    if (!dominant) return;

    for (const item of items) {
        const candidates = getCandidates(item);
        if (getMatchCount(item) <= 1 || candidates.length <= 1) continue;

        let boosted = false;
        for (const c of candidates) {
            if (c.flavor === dominant) {
                c.score += FLAVOR_BONUS;
                if (c.source === 'form_freq') c.source = 'flavor';
                boosted = true;
            }
        }
        if (!boosted) continue;

        candidates.sort((a, b) => b.score - a.score);
        applyWinner(item, candidates[0]);
    }
}
