'use server';

import Database from 'better-sqlite3';
import { prismaData as prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { checkPermission } from '@/lib/permissions';
import { Feature } from '@/config/features';
import { mergeLexemes, getDataDbPath, type MergeUpdatedFields } from '@/lib/dedup/mergeLexemes';

const LANGUAGE_KEYS = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'hsb', 'dsb', 'cu', 'de', 'nl', 'eo'] as const;

function extractAllophone(allophones: { value: string; flavor: { code: string }; type: string }[], code: string): string {
    return allophones.find(a => a.flavor.code === code && a.type === 'standard')?.value ?? '';
}

function transformLexemeResults(results: any[]) {
    return results.map((word: any) => {
        const translations: Record<string, string[]> = {};
        const isv = extractAllophone(word.lexemeAllophones, 'CORE');
        const nsl = extractAllophone(word.lexemeAllophones, 'NSL');

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
            external_id: word.external_id ?? null,
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
            translations,
        };
    });
}

export async function searchDuplicateWords(query: string, showDuplicates?: boolean) {
    const session = await auth()
    if (!await checkPermission(session, Feature.DeduplicationManage)) {
        return []
    }

    if (showDuplicates) {
        try {
            const duplicateRows = await prisma.$queryRaw<{ lexemeId: number; cnt: bigint }[]>`
                SELECT la.lexemeId, COUNT(DISTINCT l.id) as cnt
                FROM lexeme_allophones la
                JOIN allophone_flavors af ON af.id = la.flavorId
                JOIN lexemes l ON l.id = la.lexemeId
                WHERE af.code = 'CORE' AND la.type = 'standard' AND la.value IS NOT NULL AND la.value != ''
                GROUP BY la.value
                HAVING cnt > 1
                LIMIT 100
            `;

            const duplicateLexemeIds = duplicateRows.map(r => r.lexemeId);

            if (duplicateLexemeIds.length === 0) return [];

            const results = await prisma.lexeme.findMany({
                where: {
                    id: { in: duplicateLexemeIds },
                },
                include: {
                    lexemeAllophones: {
                        include: { flavor: true },
                    },
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
                take: 100,
            });

            return transformLexemeResults(results);
        } catch (error) {
            console.error('Ошибка при поиске дубликатов в БД:', error);
            return [];
        }
    }

    if (!query || query.trim().length < 2) return [];

    try {
        const results = await prisma.lexeme.findMany({
            where: {
                OR: [
                    { value: { contains: query } },
                    {
                        lexemeAllophones: {
                            some: {
                                value: { contains: query },
                            }
                        }
                    },
                ],
            },
            include: {
                lexemeAllophones: {
                    include: { flavor: true },
                },
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
            take: 30,
        });

        return transformLexemeResults(results);
    } catch (error) {
        console.error('Ошибка при поиске в БД:', error);
        return [];
    }
}

export async function mergeWordsAction(
    targetId: number,
    sourceId: number,
    updatedFields: MergeUpdatedFields
) {
    try {
        const session = await auth()
        if (!await checkPermission(session, Feature.DeduplicationManage)) {
            return { success: false, error: "Forbidden" }
        }
        const author = session?.user?.email || "unknown"

        const db = new Database(getDataDbPath());
        db.pragma("busy_timeout = 5000");
        db.transaction(() => {
            mergeLexemes(db, targetId, sourceId, updatedFields, author, session?.user?.id);
        })();

        revalidatePath('/admin/deduplication');
        return { success: true };
    } catch (error: any) {
        console.error('Ошибка транзакции слияния:', error);
        return { success: false, error: error.message || 'Ошибка выполнения транзакции базы данных.' };
    }
}