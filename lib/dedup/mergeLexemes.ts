import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export const LANGUAGE_KEYS = ['en', 'ru', 'mk', 'sr', 'uk', 'bg', 'pl', 'be', 'cs', 'sk', 'sl', 'hr', 'hsb', 'dsb', 'cu', 'de', 'nl', 'eo'] as const;

export function getDataDbPath(): string {
    return process.env.SQLITE_DB || (() => {
        const url = process.env.DATA_DATABASE_URL || "file:./prisma/interlex.db";
        return url.replace(/^file:/, '');
    })();
}

export interface MergeUpdatedFields {
    value: string; isv: string; nsl: string; usageType: string; addition: string;
    stem?: string | null; pos?: string | null; gender?: string | null; declension?: number | null;
    conjugation?: number | null; transcription?: string | null; mainCategory?: string | null;
    etymology?: string | null;
    external_id?: number | null;
}

// Merges `sourceId` into `targetId`: cascades meanings/translations, semantic
// relations, morphemes, anomalies and base_homonyms membership onto the
// target, syncs CORE/NSL allophones, writes an audit_logs entry, then deletes
// the source lexeme. Runs inside its own db.transaction — call within an
// already-open better-sqlite3 connection.
//
// Fields in `updatedFields` left `undefined` keep the target's current value
// instead of being nulled out — the caller only needs to pass the fields it
// actually wants to change (e.g. the admin merge UI only edits
// value/isv/nsl/usageType/addition; everything else must survive untouched).
export function mergeLexemes(
    db: Database.Database,
    targetId: number,
    sourceId: number,
    updatedFields: MergeUpdatedFields,
    author: string,
    userId?: string | null,
): void {
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

    // Fields not supplied by the caller fall back to the target's own current
    // value (not null) — see doc comment above.
    const pick = <T,>(v: T | undefined, fallback: T): T => (v !== undefined ? v : fallback);
    const resolved = {
        stem: pick(updatedFields.stem, targetLexeme.stem as string | null),
        pos: pick(updatedFields.pos, targetLexeme.pos as string | null),
        gender: pick(updatedFields.gender, targetLexeme.gender as string | null),
        declension: pick(updatedFields.declension, targetLexeme.declension as number | null),
        conjugation: pick(updatedFields.conjugation, targetLexeme.conjugation as number | null),
        transcription: pick(updatedFields.transcription, targetLexeme.transcription as string | null),
        mainCategory: pick(updatedFields.mainCategory, targetLexeme.mainCategory as string | null),
        etymology: pick(updatedFields.etymology, targetLexeme.etymology as string | null),
        external_id: pick(updatedFields.external_id, targetLexeme.external_id as number | null),
    };

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
    pushIfChanged('stem', targetLexeme?.stem, resolved.stem);
    pushIfChanged('pos', targetLexeme?.pos, resolved.pos);
    pushIfChanged('gender', targetLexeme?.gender, resolved.gender);
    pushIfChanged('declension', targetLexeme?.declension, resolved.declension, 'number');
    pushIfChanged('conjugation', targetLexeme?.conjugation, resolved.conjugation, 'number');
    pushIfChanged('transcription', targetLexeme?.transcription, resolved.transcription);
    pushIfChanged('mainCategory', targetLexeme?.mainCategory, resolved.mainCategory);
    pushIfChanged('etymology', targetLexeme?.etymology, resolved.etymology);
    pushIfChanged('external_id', targetLexeme?.external_id, resolved.external_id, 'number');
    changes.push({ field: 'mergedFrom', oldValue: null, newValue: sourceId });

    db.prepare(`
        UPDATE lexemes SET
            value = ?, usageType = ?, addition = ?, stem = ?, pos = ?, gender = ?,
            declension = ?, conjugation = ?, transcription = ?, mainCategory = ?,
            etymology = ?, external_id = ?
        WHERE id = ?
    `).run(
        updatedFields.value, updatedFields.usageType, updatedFields.addition,
        resolved.stem, resolved.pos, resolved.gender,
        resolved.declension, resolved.conjugation,
        resolved.transcription, resolved.mainCategory,
        resolved.etymology, resolved.external_id, targetId
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
            insertAudit.run(actionId, targetId, c.field, serialize(c.oldValue), serialize(c.newValue), userId ?? null, author);
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

        for (const lang of LANGUAGE_KEYS) {
            updateLangStmt(lang);
        }

        // Rewire semantic_relations edges from the merged-away meanings onto
        // targetMeaningId. UPDATE OR IGNORE skips a row if retargeting it would
        // collide with the unique (sourceId,targetId,relationType) index — that
        // row is simply left pointing at a meaning about to be deleted, and
        // gets cleaned up for free by the FK cascade on the DELETE below
        // (better-sqlite3 has foreign_keys=ON by default).
        db.prepare(`UPDATE OR IGNORE semantic_relations SET sourceId = ? WHERE sourceId IN (${placeholders})`).run(targetMeaningId, ...sourceMeaningIds);
        db.prepare(`UPDATE OR IGNORE semantic_relations SET targetId = ? WHERE targetId IN (${placeholders})`).run(targetMeaningId, ...sourceMeaningIds);
        // Guard against a self-loop when both sides of a relation belonged to
        // the merged-away lexeme (e.g. two of its own meanings were linked).
        db.prepare(`DELETE FROM semantic_relations WHERE sourceId = targetId`).run();

        db.prepare(`DELETE FROM meanings WHERE id IN (${placeholders})`).run(...sourceMeaningIds);
    }

    db.prepare(`UPDATE lexemes_morphemes SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId);
    db.prepare(`UPDATE inflection_anomalies SET lexemeId = ? WHERE lexemeId = ?`).run(targetId, sourceId);

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
}
