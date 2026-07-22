'use server';

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { prismaData as prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { checkPermission } from '@/lib/permissions';
import { Feature } from '@/config/features';

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
    updatedFields: {
        value: string; isv: string; nsl: string; usageType: string; addition: string;
        stem?: string; pos?: string; gender?: string; declension?: number | null;
        conjugation?: number | null; transcription?: string; mainCategory?: string;
        etymology?: string;
        external_id?: number | null;
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

            const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
            const pushIfChanged = (field: string, oldValue: unknown, newValue: unknown, compareAs: 'string' | 'number' = 'string') => {
                const changed = compareAs === 'number' ? Number(oldValue ?? null) !== Number(newValue ?? null) : String(oldValue ?? '') !== String(newValue ?? '');
                if (changed) changes.push({ field, oldValue: oldValue ?? null, newValue: newValue ?? null });
            };
            pushIfChanged('isv', oldIsv || null, updatedFields.isv);
            pushIfChanged('nsl', oldNsl || null, updatedFields.nsl);
            pushIfChanged('value', targetLexeme?.value, updatedFields.value);
            pushIfChanged('usageType', targetLexeme?.usageType, updatedFields.usageType);
            pushIfChanged('addition', targetLexeme?.addition, updatedFields.addition);
            pushIfChanged('stem', targetLexeme?.stem, updatedFields.stem ?? null);
            pushIfChanged('pos', targetLexeme?.pos, updatedFields.pos ?? null);
            pushIfChanged('gender', targetLexeme?.gender, updatedFields.gender ?? null);
            pushIfChanged('declension', targetLexeme?.declension, updatedFields.declension ?? null, 'number');
            pushIfChanged('conjugation', targetLexeme?.conjugation, updatedFields.conjugation ?? null, 'number');
            pushIfChanged('transcription', targetLexeme?.transcription, updatedFields.transcription ?? null);
            pushIfChanged('mainCategory', targetLexeme?.mainCategory, updatedFields.mainCategory ?? null);
            pushIfChanged('etymology', targetLexeme?.etymology, updatedFields.etymology ?? null);
            pushIfChanged('external_id', targetLexeme?.external_id, updatedFields.external_id ?? null, 'number');
            changes.push({ field: 'mergedFrom', oldValue: null, newValue: sourceId });

            db.prepare(`
                UPDATE lexemes SET
                    value = ?, usageType = ?, addition = ?, stem = ?, pos = ?, gender = ?,
                    declension = ?, conjugation = ?, transcription = ?, mainCategory = ?,
                    etymology = ?, external_id = ?
                WHERE id = ?
            `).run(
                updatedFields.value, updatedFields.usageType, updatedFields.addition,
                updatedFields.stem ?? null, updatedFields.pos ?? null, updatedFields.gender ?? null,
                updatedFields.declension ?? null, updatedFields.conjugation ?? null,
                updatedFields.transcription ?? null, updatedFields.mainCategory ?? null,
                updatedFields.etymology ?? null, updatedFields.external_id ?? null, targetId
            );

            // Пишем аудит той же синхронной sqlite-транзакцией (better-sqlite3 не
            // поддерживает await внутри db.transaction) — logAudit() тут не подходит.
            if (changes.length > 0) {
                const actionId = randomUUID();
                const insertAudit = db.prepare(`
                    INSERT INTO audit_logs (actionId, entityType, entityId, field, oldValue, newValue, userId, userEmail, createdAt)
                    VALUES (?, 'Lexeme', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `);
                for (const c of changes) {
                    const serialize = (v: unknown) => v === null || v === undefined ? null : (typeof v === 'string' ? v : JSON.stringify(v));
                    insertAudit.run(actionId, targetId, c.field, serialize(c.oldValue), serialize(c.newValue), session?.user?.id ?? null, author);
                }
            }

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