'use server';

import { prismaData as prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { buildEntry, append } from '@/lib/action-history';

// Список поддерживаемых языковых таблиц для автоматизации переноса
const LANGUAGE_KEYS = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'cu', 'de', 'nl', 'eo'] as const;

/**
 * Реальный поиск слов по вашей схеме
 */
export async function searchDuplicateWords(query: string) {
    if (!query || query.trim().length < 2) return [];

    try {
        // Подтягиваем слова и их смыслы со всеми языковыми переводами
        const results = await prisma.lexeme.findMany({
            where: {
                OR: [
                    { value: { contains: query } },
                    { isv: { contains: query } },
                ],
            },
            include: {
                meanings: {
                    include: {
                        ru_word: true, en_word: true, pl_word: true, uk_word: true,
                        be_word: true, cs_word: true, sk_word: true, bg_word: true,
                        mk_word: true, sr_word: true, sl_word: true, hr_word: true,
                        cu_word: true, de_word: true, nl_word: true, eo_word: true
                    }
                }
            },
            take: 30,
        });

        // Трансформируем реляционную структуру в плоский вид для удобства фронтенда
        return results.map((word) => {
            const translations: Record<string, string[]> = {};

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
                isv: word.isv || '',
                nsl: word.nsl || '',
                usageType: word.usageType || '',
                addition: word.addition || 'Источник не указан', // Поле источника
                translations, // Объект вида { ru: ["город"], pl: ["gród"] }
            };
        });
    } catch (error) {
        console.error('Ошибка при поиске в БД:', error);
        return [];
    }
}

/**
 * Продакшен-функция атомарного мержа по вашей реляционной схеме
 */
export async function mergeWordsAction(
    targetId: number,
    sourceId: number,
    updatedFields: { value: string; isv: string; nsl: string; usageType: string; addition: string }
) {
    try {
        const session = await auth()
        const author = session?.user?.email || "unknown"

        await prisma.$transaction(async (tx) => {
            // 1. Получаем текущее состояние целевого слова для аудита
            const targetWord = await tx.lexeme.findUnique({ where: { id: targetId } }) as { actionHistory?: string | null } | null

            // 2. Обновляем метаданные главного слова
            const changes: Record<string, { old: unknown; new: unknown }> = {}
            if (targetWord) {
                for (const key of ['value', 'isv', 'nsl', 'usageType', 'addition'] as const) {
                    if (String((targetWord as any)[key]) !== String(updatedFields[key])) {
                        changes[key] = { old: (targetWord as any)[key] ?? null, new: updatedFields[key] }
                    }
                }
            } else {
                for (const key of ['value', 'isv', 'nsl', 'usageType', 'addition'] as const) {
                    changes[key] = { old: null, new: updatedFields[key] }
                }
            }
            changes.mergedFrom = { old: null, new: sourceId }

            await tx.lexeme.update({
                where: { id: targetId },
                data: {
                    value: updatedFields.value,
                    isv: updatedFields.isv,
                    nsl: updatedFields.nsl,
                    usageType: updatedFields.usageType,
                    addition: updatedFields.addition,
                    actionHistory: append(targetWord?.actionHistory, buildEntry(author, changes)),
                },
            });

            // 2. Переносим переводы из Meaning(source) в Meaning(target)
            //    Находим первый смысл целевого слова (или создаём, если нет)
            const targetMeanings = await tx.meaning.findMany({
                where: { lexemeId: targetId },
                take: 1,
            });
            let targetMeaningId: number;

            if (targetMeanings.length > 0) {
                targetMeaningId = targetMeanings[0].id;
            } else {
                // У целевого слова нет ни одного смысла — создаём пустой
                const newMeaning = await tx.meaning.create({
                    data: { lexemeId: targetId },
                });
                targetMeaningId = newMeaning.id;
            }

            // Получаем все ID смыслов удаляемого слова
            const sourceMeanings = await tx.meaning.findMany({
                where: { lexemeId: sourceId },
                select: { id: true },
            });
            const sourceMeaningIds = sourceMeanings.map(m => m.id);

            if (sourceMeaningIds.length > 0) {
                // Перепривязываем все языковые записи от source к target
                const languageModels = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'cu', 'de', 'nl', 'eo'] as const;
                for (const lang of languageModels) {
                    await (tx as any)[lang].updateMany({
                        where: { meaningId: { in: sourceMeaningIds } },
                        data: { meaningId: targetMeaningId },
                    });
                }

                // Удаляем исходные смыслы (после переноса переводов они пусты)
                await tx.meaning.deleteMany({
                    where: { id: { in: sourceMeaningIds } },
                });
            }

            // 3. Перепривязываем связи с корнями (LexemeMorpheme)
            await tx.lexemeMorpheme.updateMany({
                where: { lexemeId: sourceId },
                data: { lexemeId: targetId },
            });

            // 4. Перепривязываем аномалии флексий от удаляемого слова к главному
            await tx.inflectionAnomaly.updateMany({
                where: { lexemeId: sourceId },
                data: { lexemeId: targetId },
            });

            // 5. Перепривязываем синонимы (обе стороны отношений в вашей схеме)
            await tx.synonym.updateMany({
                where: { sourceId: sourceId },
                data: { sourceId: targetId },
            });
            await tx.synonym.updateMany({
                where: { targetId: sourceId },
                data: { targetId: targetId },
            });

            // 6. Перепривязываем антонимы (обе стороны отношений)
            await tx.antonym.updateMany({
                where: { sourceId: sourceId },
                data: { sourceId: targetId },
            });
            await tx.antonym.updateMany({
                where: { targetId: sourceId },
                data: { targetId: targetId },
            });

            // 7. Теперь, когда у sourceId не осталось дочерних зависимостей, удаляем его
            await tx.lexeme.delete({
                where: { id: sourceId },
            });
        });

        revalidatePath('/admin/deduplication');
        return { success: true };
    } catch (error: any) {
        console.error('Ошибка транзакции слияния:', error);
        return { success: false, error: error.message || 'Ошибка выполнения транзакции базы данных.' };
    }
}
