'use server';

import { prismaData as prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { checkPermission } from '@/lib/permissions';
import { Feature } from '@/config/features';

const LANGUAGE_KEYS = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'hsb', 'dsb', 'cu', 'de', 'nl', 'eo'] as const;

export async function getWordsByIds(ids: number[]) {
    const session = await auth();
    if (!await checkPermission(session, Feature.DeduplicationManage)) {
        return [];
    }

    if (ids.length === 0) return [];

    const results = await prisma.lexeme.findMany({
        where: { id: { in: ids } },
        include: {
            lexemeAllophones: { include: { flavor: true } },
            meanings: {
                include: {
                    ru_word: true, en_word: true, pl_word: true, uk_word: true,
                    be_word: true, cs_word: true, sk_word: true, bg_word: true,
                    mk_word: true, sr_word: true, sl_word: true, hr_word: true,
                    hsb_word: true, dsb_word: true,
                    cu_word: true, de_word: true, nl_word: true, eo_word: true
                }
            }
        },
    });

    return results.map((word: any) => {
        const translations: Record<string, string[]> = {};
        const isv = word.lexemeAllophones.find((a: any) => a.flavor.code === 'CORE' && a.type === 'standard')?.value ?? '';
        const nsl = word.lexemeAllophones.find((a: any) => a.flavor.code === 'NSL' && a.type === 'standard')?.value ?? '';

        word.meanings.forEach((m: any) => {
            LANGUAGE_KEYS.forEach((lang) => {
                const relationField = `${lang}_word`;
                if (m[relationField] && Array.isArray(m[relationField])) {
                    m[relationField].forEach((t: any) => {
                        if (t.value) {
                            if (!translations[lang]) translations[lang] = [];
                            if (!translations[lang].includes(t.value)) translations[lang].push(t.value);
                        }
                    });
                }
            });
        });

        return {
            id: word.id,
            value: word.value || '',
            isv,
            nsl,
            stem: word.stem || '',
            pos: word.pos || '',
            gender: word.gender || '',
            declension: word.declension ?? null,
            conjugation: word.conjugation ?? null,
            transcription: word.transcription || '',
            mainCategory: word.mainCategory || '',
            etymology: word.etymology || '',
            usageType: word.usageType || '',
            addition: word.addition || '',
            external_id: word.external_id || '',
            translations,
        };
    });
}