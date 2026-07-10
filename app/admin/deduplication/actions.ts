'use server';

import { prismaData as prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { checkPermission } from '@/lib/permissions';
import { Feature } from '@/config/features';
import { buildEntry, append } from '@/lib/action-history';

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
            isv,
            nsl,
            usageType: word.usageType || '',
            addition: word.addition || 'Источник не указан',
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
    updatedFields: { value: string; isv: string; nsl: string; usageType: string; addition: string }
) {
    try {
        const session = await auth()
        if (!await checkPermission(session, Feature.DeduplicationManage)) {
            return { success: false, error: "Forbidden" }
        }
        const author = session?.user?.email || "unknown"

        await prisma.$transaction(async (tx) => {
            const targetWord = await tx.lexeme.findUnique({
                where: { id: targetId },
                include: { lexemeAllophones: { include: { flavor: true } } }
            }) as { actionHistory?: string | null; value?: string | null; usageType?: string | null; addition?: string | null; lexemeAllophones?: { value: string; flavor: { code: string }; type: string }[] } | null

            const changes: Record<string, { old: unknown; new: unknown }> = {}
            const oldIsv = targetWord ? extractAllophone(targetWord.lexemeAllophones || [], 'CORE') : ''
            const oldNsl = targetWord ? extractAllophone(targetWord.lexemeAllophones || [], 'NSL') : ''

            if (String(oldIsv) !== String(updatedFields.isv)) {
                changes.isv = { old: oldIsv || null, new: updatedFields.isv }
            }
            if (String(oldNsl) !== String(updatedFields.nsl)) {
                changes.nsl = { old: oldNsl || null, new: updatedFields.nsl }
            }
            if (String(targetWord?.value ?? '') !== String(updatedFields.value)) {
                changes.value = { old: targetWord?.value ?? null, new: updatedFields.value }
            }
            if (String(targetWord?.usageType ?? '') !== String(updatedFields.usageType)) {
                changes.usageType = { old: targetWord?.usageType ?? null, new: updatedFields.usageType }
            }
            if (String(targetWord?.addition ?? '') !== String(updatedFields.addition)) {
                changes.addition = { old: targetWord?.addition ?? null, new: updatedFields.addition }
            }
            changes.mergedFrom = { old: null, new: sourceId }

            await tx.lexeme.update({
                where: { id: targetId },
                data: {
                    value: updatedFields.value,
                    usageType: updatedFields.usageType,
                    addition: updatedFields.addition,
                    actionHistory: append(targetWord?.actionHistory, buildEntry(author, changes)),
                },
            });

            if (updatedFields.isv) {
                const coreFlavor = await tx.allophoneFlavor.findUnique({ where: { code: 'CORE' } });
                if (coreFlavor) {
                    const existingCore = await tx.lexemeAllophone.findUnique({
                        where: { lexemeId_flavorId_type: { lexemeId: targetId, flavorId: coreFlavor.id, type: 'standard' } }
                    });
                    if (existingCore) {
                        await tx.lexemeAllophone.update({
                            where: { id: existingCore.id },
                            data: { value: updatedFields.isv }
                        });
                    } else {
                        await tx.lexemeAllophone.create({
                            data: { lexemeId: targetId, flavorId: coreFlavor.id, value: updatedFields.isv, type: 'standard' }
                        });
                    }
                }
            }

            if (updatedFields.nsl) {
                const nslFlavor = await tx.allophoneFlavor.findUnique({ where: { code: 'NSL' } });
                if (nslFlavor) {
                    const existingNsl = await tx.lexemeAllophone.findUnique({
                        where: { lexemeId_flavorId_type: { lexemeId: targetId, flavorId: nslFlavor.id, type: 'standard' } }
                    });
                    if (existingNsl) {
                        await tx.lexemeAllophone.update({
                            where: { id: existingNsl.id },
                            data: { value: updatedFields.nsl }
                        });
                    } else {
                        await tx.lexemeAllophone.create({
                            data: { lexemeId: targetId, flavorId: nslFlavor.id, value: updatedFields.nsl, type: 'standard' }
                        });
                    }
                }
            }

            const targetMeanings = await tx.meaning.findMany({
                where: { lexemeId: targetId },
                take: 1,
            });
            let targetMeaningId: number;

            if (targetMeanings.length > 0) {
                targetMeaningId = targetMeanings[0].id;
            } else {
                const newMeaning = await tx.meaning.create({
                    data: { lexemeId: targetId },
                });
                targetMeaningId = newMeaning.id;
            }

            const sourceMeanings = await tx.meaning.findMany({
                where: { lexemeId: sourceId },
                select: { id: true },
            });
            const sourceMeaningIds = sourceMeanings.map(m => m.id);

            if (sourceMeaningIds.length > 0) {
                const languageModels = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'hsb', 'dsb', 'cu', 'de', 'nl', 'eo'] as const;
                for (const lang of languageModels) {
                    await (tx as any)[lang].updateMany({
                        where: { meaningId: { in: sourceMeaningIds } },
                        data: { meaningId: targetMeaningId },
                    });
                }

                await tx.meaning.deleteMany({
                    where: { id: { in: sourceMeaningIds } },
                });
            }

            await tx.lexemeMorpheme.updateMany({
                where: { lexemeId: sourceId },
                data: { lexemeId: targetId },
            });

            await tx.inflectionAnomaly.updateMany({
                where: { lexemeId: sourceId },
                data: { lexemeId: targetId },
            });

            await tx.synonym.updateMany({
                where: { sourceId: sourceId },
                data: { sourceId: targetId },
            });
            await tx.synonym.updateMany({
                where: { targetId: sourceId },
                data: { targetId: targetId },
            });

            await tx.antonym.updateMany({
                where: { sourceId: sourceId },
                data: { sourceId: targetId },
            });
            await tx.antonym.updateMany({
                where: { targetId: sourceId },
                data: { targetId: targetId },
            });

            await tx.lexeme.delete({
                where: { id: sourceId },
            });

            const allHomonyms = await tx.baseHomonym.findMany();
            for (const h of allHomonyms) {
                const ids: number[] = JSON.parse(h.wordIds);
                if (ids.includes(sourceId)) {
                    const filtered = ids.filter((id: number) => id !== sourceId);
                    if (filtered.length === 0) {
                        await tx.baseHomonym.delete({ where: { id: h.id } });
                    } else {
                        await tx.baseHomonym.update({
                            where: { id: h.id },
                            data: { wordIds: JSON.stringify(filtered) },
                        });
                    }
                }
            }
        });

        revalidatePath('/admin/deduplication');
        return { success: true };
    } catch (error: any) {
        console.error('Ошибка транзакции слияния:', error);
        return { success: false, error: error.message || 'Ошибка выполнения транзакции базы данных.' };
    }
}