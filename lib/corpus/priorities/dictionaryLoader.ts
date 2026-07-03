import { PrismaClient } from '@prisma/client';
import { PosType, GrammaticalCase } from '@/lib/grammar/common';
import { PriorityDictionary, PriorityDictionaryEntry, isValidDistribution, FormDistributionItem } from './types';

const corpusDb = new PrismaClient();

export async function loadPriorityDictionary(): Promise<PriorityDictionary> {
    const dictionary: PriorityDictionary = new Map();

    const records = await corpusDb.wordFormPriority.findMany({
        select: { surfaceForm: true, distributions: true },
    });

    for (const record of records) {
        const rawDistributions = record.distributions;

        if (!isValidDistribution(rawDistributions)) {
            continue;
        }

        const distList: FormDistributionItem[] = rawDistributions;

        const options: PriorityDictionaryEntry[] = distList.map(item => ({
            lemmaSlug: item.slug,
            pos: item.pos as PosType,
            feats: {
                ...(item.case ? { case: item.case } : {}),
                ...(item.number ? { number: item.number } : {}),
            },
            priority: item.freq,
        }));

        dictionary.set(record.surfaceForm, options);
    }

    return dictionary;
}
