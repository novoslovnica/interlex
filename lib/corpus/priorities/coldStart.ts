import { PrismaClient, Prisma } from '@prisma/client';
import { generateWordForms } from '@/lib/grammar/morphology/engine';
import { EngineWordInput } from '@/lib/grammar/morphology';
import { PosType, GrammaticalCase, GrammaticalNumber, isEnumMatch, MorphoGrammarFeats } from '@/lib/grammar/common';
import { FormDistributionItem, CASE_WEIGHTS } from './types';

const mainDb = new PrismaClient({ datasources: { db: { url: process.env.MAIN_DATABASE_URL } } });
const corpusDb = new PrismaClient({ datasources: { db: { url: process.env.ANALYTICS_DATABASE_URL } } });

function featsToDistribution(
    feats: MorphoGrammarFeats,
    slug: string,
    pos: PosType,
    baseFreq: number
): FormDistributionItem {
    const caseValue = feats.case;
    const numberValue = feats.number;
    const weightMultiplier = caseValue ? (CASE_WEIGHTS[caseValue] ?? 0.1) : 1.0;

    return {
        slug,
        pos,
        case: caseValue,
        number: numberValue,
        freq: Math.round(baseFreq * weightMultiplier),
    };
}

export async function runColdStart(): Promise<{ created: number; updated: number }> {
    const words = await mainDb.word.findMany({
        select: {
            id: true,
            slug: true,
            isv: true,
            pos: true,
            protoStemClass: true,
            stemExtension: true,
            paradigm: true,
            base: true,
            gender: true,
            alternationType: true,
            fleetingVowelAt: true,
        },
    });

    const globalDistributions = new Map<string, FormDistributionItem[]>();

    for (const word of words) {
        if (!word.isv || !word.pos) continue;

        const posTag = word.pos.toUpperCase();
        if (!isEnumMatch(posTag, PosType)) continue;

        const engineInput: EngineWordInput = {
            id: word.id,
            slug: word.slug,
            isv: word.isv,
            pos: posTag,
            protoStemClass: word.protoStemClass,
            stemExtension: word.stemExtension,
            paradigm: word.paradigm,
            stem: word.stem,
            gender: word.gender,
            alternationType: word.alternationType,
            fleetingVowelAt: word.fleetingVowelAt,
        };

        const generatedForms = generateWordForms(engineInput, true);
        const baseWordFrequency = 1000;

        for (const form of generatedForms) {
            const surfaceFormLower = form.surfaceForm.toLowerCase().trim();
            const existingDist = globalDistributions.get(surfaceFormLower) || [];

            const distItem = featsToDistribution(
                form.feats,
                word.slug,
                posTag as PosType,
                baseWordFrequency
            );

            existingDist.push(distItem);
            globalDistributions.set(surfaceFormLower, existingDist);
        }
    }

    const existingSurfaceForms = new Set(
        (await corpusDb.wordFormPriority.findMany({ select: { surfaceForm: true } }))
            .map(f => f.surfaceForm)
    );

    const toCreate: Prisma.WordFormPriorityCreateManyInput[] = [];
    const toUpdate: { surfaceForm: string; distributions: Prisma.InputJsonValue }[] = [];
    const BATCH_SIZE = 1000;

    for (const [surfaceForm, distributions] of globalDistributions.entries()) {
        const sorted = distributions.sort((a, b) => b.freq - a.freq);

        if (existingSurfaceForms.has(surfaceForm)) {
            toUpdate.push({
                surfaceForm,
                distributions: sorted as unknown as Prisma.InputJsonValue,
            });
        } else {
            toCreate.push({
                surfaceForm,
                distributions: sorted as unknown as Prisma.InputJsonValue,
            });
        }
    }

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

    return { created: toCreate.length, updated: toUpdate.length };
}
