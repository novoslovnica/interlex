import { PosType } from '@/lib/grammar/common';
import { SyntaxToken } from './types';
import { normalizeCase } from './caseUtils';
import { NounPhrase } from './npChunker';

/**
 * Ближайшее предшествующее сказуемое для присоединения аргумента — при
 * сочинённых сказуемых ("dobyla kompleks, razvalila jego i sožegla")
 * каждое сказуемое должно получать СВОИ зависимые, а не всё подряд к root.
 * predicateIndices отсортирован по возрастанию (порядок токенов).
 */
export function localPredicateFor(index: number, predicateIndices: number[]): number {
    let candidate = predicateIndices[0];
    for (const pi of predicateIndices) {
        if (pi < index) candidate = pi;
        else break;
    }
    return candidate;
}

export interface CoordinationTarget {
    headTokenIndex: number;
    ccIndex?: number;
}

/**
 * Является ли именная группа p сочинённым конъюнктом уже обработанной
 * ранее группы q ("Ivan i Petr" — Petr:conj→Ivan, i:cc→Petr). Требует
 * явного CCONJ непосредственно перед началом группы p (включая её
 * модификаторы) и совпадения падежа с q, когда падеж известен на обеих
 * сторонах — простая, но надёжная защита от ложных срабатываний.
 * Бессоюзные (через запятую) списки аргументов не распознаются — в отличие
 * от сочинения сказуемых, где это гораздо чаще встречается в реальном
 * корпусе и поддержано отдельно в clause.ts.
 */
export function findNominalCoordinationTarget(
    tokens: SyntaxToken[],
    phrases: NounPhrase[],
    p: NounPhrase,
    processedHeadIndices: Set<number>
): CoordinationTarget | undefined {
    const spanStart = p.modifierIndices.length > 0 ? Math.min(...p.modifierIndices) : p.headIndex;
    const cconjIndex = spanStart - 1;
    if (cconjIndex < 0 || tokens[cconjIndex].pos !== PosType.CCONJ) return undefined;

    const beforeCconj = cconjIndex - 1;
    const target = phrases.find(q => q.headIndex === beforeCconj && processedHeadIndices.has(q.headIndex));
    if (!target) return undefined;

    const targetCase = normalizeCase(tokens[target.headIndex].feats.case);
    const pCase = normalizeCase(tokens[p.headIndex].feats.case);
    if (targetCase && pCase && targetCase !== pCase) return undefined;

    return { headTokenIndex: target.headIndex, ccIndex: cconjIndex };
}
