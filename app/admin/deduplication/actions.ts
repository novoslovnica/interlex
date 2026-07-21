'use server';

import Database from 'better-sqlite3';
import { prismaData as prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { checkPermission } from '@/lib/permissions';
import { Feature } from '@/config/features';
import { buildEntry, append } from '@/lib/action-history';

const LANGUAGE_KEYS = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'hsb', 'dsb', 'cu', 'de', 'nl', 'eo'] as const;

function getDbPath(): string {
    return process.env.SQLITE_DB || (() => {
        const url = process.env.DATA_DATABASE_URL || "file:./prisma/interlex.db";
        return url.replace(/^file:/, '');
    })();
}

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
            externalId: word.external_id ?? null,
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
    updatedFields: {
        value: string; isv: string; nsl: string; usageType: string; addition: string;
        stem?: string; pos?: string; gender?: string; declension?: number | null;
        conjugation?: number | null; transcription?: string; mainCategory?: string;
        etymology?: string; externalId?: number | null;
    }
) {
    try {
        const session = await auth()
        if (!await checkPermission(session, Feature.DeduplicationManage)) {
            return { success: false, error: "Forbidden" }
        }
        const author = session?.user?.email || "unknown"

        const db = new Database(getDbPath());

        const result = db.transaction(() => {
            const coreFlavorId = db.prepare(`SELECT id FROM allophone_flavors WHERE code = ?`).get('CORE') as { id: number } | undefined;
            const nslFlavorId = db.prepare(`SELECT id FROM allophone_flavors WHERE code = ?`).get('NSL') as { id: number } | undefined;

            const targetLexeme = db.prepare(`SELECT * FROM lexemes WHERE id = ?`).get(targetId) as Record<string, unknown> | undefined;
            if (!targetLexeme) throw new Error(`Target lexeme ${targetId} not found`);

            const oldIsv = coreFlavorId
                ? (db.prepare(`SELECT value FROM lexeme_allophones WHERE lexemeId = ? AND flavorId = ? AND type = 'standard'`).get(targetId, coreFlavorId.id) as { value: string } | undefined)?.value ?? ''
                : '';
            const oldNsl = nslFlavorId
                ? (db.prepare(`SELECT value FROM lexeme_allophones WHERE lexemeId = ? AND flavorId = ? AND type = 'standard'`).get(targetId, nslFlavorId.id) as { value: string } | undefined)?.value ?? ''
                : '';

            const changes: Record<string, { old: unknown; new: unknown }> = {};
            if (String(oldIsv) !== String(updatedFields.isv)) changes.isv = { old: oldIsv || null, new: updatedFields.isv };
            if (String(oldNsl) !== String(updatedFields.nsl)) changes.nsl = { old: oldNsl || null, new: updatedFields.nsl };
            if (String(targetLexeme?.value ?? '') !== String(updatedFields.value)) changes.value = { old: targetLexeme?.value ?? null, new: updatedFields.value };
            if (String(targetLexeme?.usageType ?? '') !== String(updatedFields.usageType)) changes.usageType = { old: targetLexeme?.usageType ?? null, new: updatedFields.usageType };
            if (String(targetLexeme?.addition ?? '') !== String(updatedFields.addition)) changes.addition = { old: targetLexeme?.addition ?? null, new: updatedFields.addition };
            if (String(targetLexeme?.stem ?? '') !== String(updatedFields.stem ?? '')) changes.stem = { old: targetLexeme?.stem ?? null, new: updatedFields.stem ?? null };
            if (String(targetLexeme?.pos ?? '') !== String(updatedFields.pos ?? '')) changes.pos = { old: targetLexeme?.pos ?? null, new: updatedFields.pos ?? null };
            if (String(targetLexeme?.gender ?? '') !== String(updatedFields.gender ?? '')) changes.gender = { old: targetLexeme?.gender ?? null, new: updatedFields.gender ?? null };
            if (Number(targetLexeme?.declension ?? null) !== Number(updatedFields.declension ?? null)) changes.declension = { old: targetLexeme?.declension ?? null, new: updatedFields.declension ?? null };
            if (Number(targetLexeme?.conjugation ?? null) !== Number(updatedFields.conjugation ?? null)) changes.conjugation = { old: targetLexeme?.conjugation ?? null, new: updatedFields.conjugation ?? null };
            if (String(targetLexeme?.transcription ?? '') !== String(updatedFields.transcription ?? '')) changes.transcription = { old: targetLexeme?.transcription ?? null, new: updatedFields.transcription ?? null };
            if (String(targetLexeme?.mainCategory ?? '') !== String(updatedFields.mainCategory ?? '')) changes.mainCategory = { old: targetLexeme?.mainCategory ?? null, new: updatedFields.mainCategory ?? null };
            if (String(targetLexeme?.etymology ?? '') !== String(updatedFields.etymology ?? '')) changes.etymology = { old: targetLexeme?.etymology ?? null, new: updatedFields.etymology ?? null };
            if (Number(targetLexeme?.external_id ?? null) !== Number(updatedFields.externalId ?? null)) changes.externalId = { old: targetLexeme?.external_id ?? null, new: updatedFields.externalId ?? null };
            changes.mergedFrom = { old: null, new: sourceId };

            const currentHistory = (targetLexeme?.actionHistory as string) || null;
            const newHistory = append(currentHistory, buildEntry(author, changes));

            db.prepare(`
                UPDATE lexemes SET
                    value = ?, usageType = ?, addition = ?, stem = ?, pos = ?, gender = ?,
                    declension = ?, conjugation = ?, transcription = ?, mainCategory = ?,
                    etymology = ?, external_id = ?, actionHistory = ?
                WHERE id = ?
            `).run(
                updatedFields.value, updatedFields.usageType, updatedFields.addition,
                updatedFields.stem ?? null, updatedFields.pos ?? null, updatedFields.gender ?? null,
                updatedFields.declension ?? null, updatedFields.conjugation ?? null,
                updatedFields.transcription ?? null, updatedFields.mainCategory ?? null,
                updatedFields.etymology ?? null, updatedFields.externalId ?? null, newHistory, targetId
            );

            if (updatedFields.isv && coreFlavorId) {
                const existing = db.prepare(`SELECT id FROM lexeme_allophones WHERE lexemeId = ? AND flavorId = ? AND type = 'standard'`).get(targetId, coreFlavorId.id) as { id: number } | undefined;
                if (existing) {
                    db.prepare(`UPDATE lexeme_allophones SET value = ? WHERE id = ?`).run(updatedFields.isv, existing.id);
                } else {
                    db.prepare(`INSERT INTO lexeme_allophones (lexemeId, flavorId, value, type) VALUES (?, ?, ?, 'standard')`).run(targetId, coreFlavorId.id, updatedFields.isv);
                }
            }

            if (updatedFields.nsl && nslFlavorId) {
                const existing = db.prepare(`SELECT id FROM lexeme_allophones WHERE lexemeId = ? AND flavorId = ? AND type = 'standard'`).get(targetId, nslFlavorId.id) as { id: number } | undefined;
                if (existing) {
                    db.prepare(`UPDATE lexeme_allophones SET value = ? WHERE id = ?`).run(updatedFields.nsl, existing.id);
                } else {
                    db.prepare(`INSERT INTO lexeme_allophones (lexemeId, flavorId, value, type) VALUES (?, ?, ?, 'standard')`).run(targetId, nslFlavorId.id, updatedFields.nsl);
                }
            }

            const targetMeaning = db.prepare(`SELECT id FROM meanings WHERE lexemeId = ? LIMIT 1`).get(targetId) as { id: number } | undefined;
            let targetMeaningId: number;
            if (targetMeaning) {
                targetMeaningId = targetMeaning.id;
            } else {
                const info = db.prepare(`INSERT INTO meanings (lexemeId) VALUES (?)`).run(targetId);
                targetMeaningId = Number(info.lastInsertRowid);
            }

            const sourceMeanings = db.prepare(`SELECT id FROM meanings WHERE lexemeId = ?`).all(sourceId) as { id: number }[];
            const sourceMeaningIds = sourceMeanings.map(m => m.id);

            if (sourceMeaningIds.length > 0) {
                const placeholders = sourceMeaningIds.map(() => '?').join(',');
                const updateLangStmt = (lang: string) =>
                    db.prepare(`UPDATE "${lang}" SET "meaningId" = ? WHERE "meaningId" IN (${placeholders})`).run(targetMeaningId, ...sourceMeaningIds);

                const languageModels = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'hsb', 'dsb', 'cu', 'de', 'nl', 'eo'] as const;
                for (const lang of languageModels) {
                    updateLangStmt(lang);
                }

                db.prepare(`DELETE FROM meanings WHERE id IN (${placeholders})`).run(...sourceMeaningIds);
            }

            db.prepare(`UPDATE lexemes_morphemes SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId);
            db.prepare(`UPDATE inflection_anomalies SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId);
            db.prepare(`UPDATE synonyms SET sourceId = ? WHERE sourceId = ?`).run(targetId, sourceId);
            db.prepare(`UPDATE synonyms SET targetId = ? WHERE targetId = ?`).run(targetId, sourceId);
            db.prepare(`UPDATE antonyms SET sourceId = ? WHERE sourceId = ?`).run(targetId, sourceId);
            db.prepare(`UPDATE antonyms SET targetId = ? WHERE targetId = ?`).run(targetId, sourceId);

            db.prepare(`DELETE FROM lexemes WHERE id = ?`).run(sourceId);

            const allHomonyms = db.prepare(`SELECT * FROM base_homonyms`).all() as { id: number; wordIds: string }[];
            for (const h of allHomonyms) {
                const ids: number[] = JSON.parse(h.wordIds);
                if (ids.includes(sourceId)) {
                    const filtered = ids.filter((id: number) => id !== sourceId);
                    if (filtered.length === 0) {
                        db.prepare(`DELETE FROM base_homonyms WHERE id = ?`).run(h.id);
                    } else {
                        db.prepare(`UPDATE base_homonyms SET wordIds = ? WHERE id = ?`).run(JSON.stringify(filtered), h.id);
                    }
                }
            }
        });

        result();

        revalidatePath('/admin/deduplication');
        return { success: true };
    } catch (error: any) {
        console.error('Ошибка транзакции слияния:', error);
        return { success: false, error: error.message || 'Ошибка выполнения транзакции базы данных.' };
    }
}