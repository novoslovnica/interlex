import { GrammaticalCase } from '@/lib/grammar/common';
import { FormDistributionItem } from '../priorities/types';

const CASE_GOVERNMENT: Record<string, GrammaticalCase[]> = {
    v: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    vo: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    na: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    o: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    ob: [GrammaticalCase.LOC, GrammaticalCase.ACC],
    k: [GrammaticalCase.DAT],
    ko: [GrammaticalCase.DAT],
    bez: [GrammaticalCase.GEN],
    iz: [GrammaticalCase.GEN],
    do: [GrammaticalCase.GEN],
    ot: [GrammaticalCase.GEN],
    u: [GrammaticalCase.GEN],
    s: [GrammaticalCase.INS, GrammaticalCase.GEN],
    so: [GrammaticalCase.INS, GrammaticalCase.GEN],
    za: [GrammaticalCase.INS, GrammaticalCase.ACC],
    nad: [GrammaticalCase.INS],
    pod: [GrammaticalCase.INS, GrammaticalCase.ACC],
    pred: [GrammaticalCase.INS, GrammaticalCase.ACC],
    medzu: [GrammaticalCase.INS, GrammaticalCase.ACC],
    po: [GrammaticalCase.LOC, GrammaticalCase.DAT, GrammaticalCase.ACC],
    pro: [GrammaticalCase.ACC],
    pri: [GrammaticalCase.LOC],
    mimo: [GrammaticalCase.GEN],
    protiv: [GrammaticalCase.GEN],
    kromě: [GrammaticalCase.GEN],
    radi: [GrammaticalCase.GEN],
    dlja: [GrammaticalCase.GEN],
};

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
    const expectedCases = CASE_GOVERNMENT[leftWord];

    if (!expectedCases) return null;

    for (const expectedCase of expectedCases) {
        const match = options.find(opt => opt.case === expectedCase);
        if (match) return match;
    }

    return null;
}

export function getExpectedCases(preposition: string): GrammaticalCase[] {
    const key = preposition.toLowerCase().trim();
    return CASE_GOVERNMENT[key] ?? [];
}