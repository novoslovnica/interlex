import { PosType, GrammaticalCase, GrammaticalNumber } from '@/lib/grammar/common';

export interface FormDistributionItem {
    slug: string;
    pos: PosType;
    case?: GrammaticalCase;
    number?: GrammaticalNumber;
    freq: number;
}

export interface PriorityDictionaryEntry {
    lemmaSlug: string;
    pos: PosType;
    feats: Record<string, string | undefined>;
    priority: number;
}

export type PriorityDictionary = Map<string, PriorityDictionaryEntry[]>;

export function isValidDistribution(json: unknown): json is FormDistributionItem[] {
    if (!Array.isArray(json)) return false;
    return json.every(
        (item) =>
            item &&
            typeof item === 'object' &&
            typeof (item as FormDistributionItem).slug === 'string' &&
            typeof (item as FormDistributionItem).pos === 'string' &&
            typeof (item as FormDistributionItem).freq === 'number'
    );
}

export const CASE_WEIGHTS: Record<string, number> = {
    nom: 0.35,
    acc: 0.35,
    gen: 0.15,
    dat: 0.05,
    loc: 0.05,
    ins: 0.05,
    voc: 0.01,
};
