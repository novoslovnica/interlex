import { FormDistributionItem } from '../priorities/types';
import { PREPOSITION_GOVERNMENT, getExpectedCasesForPreposition } from '../syntax/government';

export interface TokenContext {
    currentForm: string;
    leftNeighbor?: string;
    rightNeighbor?: string;
}

export function applyContextRules(
    context: TokenContext,
    options: FormDistributionItem[]
): FormDistributionItem | null {
    if (!context.leftNeighbor || options.length === 0) return null;

    const leftWord = context.leftNeighbor.toLowerCase().trim();
    const expectedCases = PREPOSITION_GOVERNMENT[leftWord];

    if (!expectedCases) return null;

    for (const expectedCase of expectedCases) {
        const match = options.find(opt => opt.case === expectedCase);
        if (match) return match;
    }

    return null;
}

export const getExpectedCases = getExpectedCasesForPreposition;