import { PrismaClient, Prisma } from '@prisma/client';
import { PosType, GrammaticalCase } from '@/lib/grammar/common';
import { FormDistributionItem, isValidDistribution } from './types';

const corpusDb = new PrismaClient();

function extractCaseFromFeats(feats: unknown): string | undefined {
    if (feats && typeof feats === 'object' && !Array.isArray(feats)) {
        const rec = feats as Record<string, unknown>;
        const caseVal = rec['case'];
        if (typeof caseVal === 'string') return caseVal;
    }
    return undefined;
}

export async function recalculateWordFormPriorities(): Promise<{ updated: number; created: number }> {
    const tokenAggregations = await corpusDb.corpusToken.groupBy({
        by: ['surfaceForm', 'lemma', 'pos', 'feats'],
        _count: { id: true },
    });

    const empiricalMap = new Map<string, FormDistributionItem[]>();

    for (const row of tokenAggregations) {
        const surfaceFormLower = row.surfaceForm.toLowerCase().trim();
        const caseTag = extractCaseFromFeats(row.feats);
        const existingDist = empiricalMap.get(surfaceFormLower) || [];

        existingDist.push({
            slug: row.lemma,
            pos: row.pos as PosType,
            case: caseTag as GrammaticalCase | undefined,
            freq: row._count.id,
        });

        empiricalMap.set(surfaceFormLower, existingDist);
    }

    const currentPriorities = await corpusDb.wordFormPriority.findMany({
        select: { surfaceForm: true, distributions: true },
    });

    const toUpdate: { surfaceForm: string; distributions: Prisma.InputJsonValue }[] = [];
    const processedForms = new Set<string>();

    for (const current of currentPriorities) {
        const surfaceForm = current.surfaceForm;
        processedForms.add(surfaceForm);

        const realDistributions = empiricalMap.get(surfaceForm);
        if (!realDistributions) continue;

        if (isValidDistribution(current.distributions)) {
            const theoreticalDist: FormDistributionItem[] = current.distributions;
            const realKeys = new Set(realDistributions.map(d => `${d.slug}_${d.case || ''}`));

            for (const tOpt of theoreticalDist) {
                if (!realKeys.has(`${tOpt.slug}_${tOpt.case || ''}`)) {
                    realDistributions.push({ ...tOpt, freq: 1 });
                }
            }
        }

        const sorted = realDistributions.sort((a, b) => b.freq - a.freq);
        toUpdate.push({
            surfaceForm,
            distributions: sorted as unknown as Prisma.InputJsonValue,
        });
    }

    const toCreate: Prisma.WordFormPriorityCreateManyInput[] = [];
    for (const [surfaceForm, distributions] of empiricalMap.entries()) {
        if (!processedForms.has(surfaceForm)) {
            const sorted = distributions.sort((a, b) => b.freq - a.freq);
            toCreate.push({
                surfaceForm,
                distributions: sorted as unknown as Prisma.InputJsonValue,
            });
        }
    }

    const BATCH_SIZE = 1000;

    if (toCreate.length > 0) {
        for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
            await corpusDb.wordFormPriority.createMany({
                data: toCreate.slice(i, i + BATCH_SIZE),
                skipDuplicates: true,
            });
        }
    }

    if (toUpdate.length > 0) {
        for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
            const batch = toUpdate.slice(i, i + BATCH_SIZE);
            await corpusDb.$transaction(
                batch.map(item =>
                    corpusDb.wordFormPriority.update({
                        where: { surfaceForm: item.surfaceForm },
                        data: { distributions: item.distributions },
                    })
                )
            );
        }
    }

    return { updated: toUpdate.length, created: toCreate.length };
}
