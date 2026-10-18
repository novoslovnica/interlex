import type Database from "better-sqlite3";
import {init} from "@/lib/sqlite";
import {foldDiacritics} from "@/lib/corpus/tokenizer/foldDiacritics";
import {fetchTranslationsForMeaningIds, TRANSLATION_LANGUAGE_CODES, type TranslationRow} from "@/lib/translations";
import {validateLexiconPagination} from "@/lib/lexiconPagination";

interface LexemeRow {
    id: number;
    value: string | null;
    slug: string;
    pos: string | null;
    meaningId: number | null;
    meaningText: string | null;
    examples: string | null;
    meaningVerified: number | null;
    [field: string]: unknown;
}
interface Allophone { value: string; flavorCode: string; type: string }
export interface LexiconItem extends LexemeRow {
    word: Allophone | null;
    allophones: Allophone[];
    verified: boolean;
    duplicateCount: number;
    duplicateIds: number[];
}

const LEXEME_COLUMNS = `
    l.id, la_core.value AS isv, la_nsl.value AS nsl, la_core.verified AS isvVerified, la_nsl.verified AS nslVerified, l.value, l.slug, l.stem, l.pos, l.gender,
    l.declension, l.conjugation, l.transcription,
    l.aspect, l.transitivity, l.animacy, l.degree,
    l.pronType, l.numType, l.frequency, l.intelligibility,
    l.addition, l.sameInLanguages, l.etymology, l.proto,
    l.paradigm, l.protoStemClass, l.stemExtension, l.genesis,
    l.secondaryStem, l.tertiaryStem,
    l.hasAnomalies, l.mainCategory, l.usageType, l.isPublic, l.external_id
`;

const LEXEME_JOINS = `
    FROM lexemes l
    LEFT JOIN lexeme_allophones la_core ON la_core.lexemeId = l.id AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE') AND la_core.type = 'standard'
    LEFT JOIN lexeme_allophones la_nsl ON la_nsl.lexemeId = l.id AND la_nsl.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'NSL') AND la_nsl.type = 'standard'
`;

// Enrich only the bounded SQL page. Meanings and review filters are already
// selected before LIMIT; never expand a lexeme into more response rows here.
const enrichLexemeRows = (db: Database.Database, data: LexemeRow[]): LexiconItem[] => {
    if (data.length === 0) return [];
    const ids = [...new Set(data.map(item => item.id))];
    const meaningIds = data.map(item => item.meaningId).filter((id): id is number => id !== null);
    const translations = fetchTranslationsForMeaningIds(db, meaningIds, [...TRANSLATION_LANGUAGE_CODES]);
    const allophones = db.prepare(`
        SELECT la.lexemeId, la.value, af.code AS flavorCode, la.type
        FROM lexeme_allophones la JOIN allophone_flavors af ON af.id = la.flavorId
        WHERE la.lexemeId IN (${ids.map(() => '?').join(',')})
        ORDER BY la.id
    `).all(...ids) as (Allophone & { lexemeId: number })[];
    const byLexeme = new Map<number, Allophone[]>();
    for (const {lexemeId, ...allophone} of allophones) {
        const list = byLexeme.get(lexemeId) ?? [];
        list.push(allophone);
        byLexeme.set(lexemeId, list);
    }
    const values = [...new Set(data.map(item => item.value).filter((value): value is string => !!value))];
    const duplicates = values.length > 0 ? db.prepare(`
        SELECT id, value FROM lexemes WHERE value IN (${values.map(() => '?').join(',')}) ORDER BY id
    `).all(...values) as { id: number; value: string }[] : [];
    const byValue = new Map<string, number[]>();
    for (const row of duplicates) {
        const list = byValue.get(row.value) ?? [];
        list.push(row.id);
        byValue.set(row.value, list);
    }
    return data.map(item => {
        const languages: Record<string, TranslationRow[]> = {};
        for (const lang of TRANSLATION_LANGUAGE_CODES) {
            languages[lang] = item.meaningId === null ? [] : translations[lang]?.[item.meaningId] ?? [];
        }
        const forms = byLexeme.get(item.id) ?? [];
        const duplicateIds = item.value ? byValue.get(item.value) ?? [] : [];
        return {
            ...item, ...languages,
            word: forms.find(a => a.flavorCode === 'CORE' && a.type === 'standard') ?? null,
            allophones: forms,
            verified: Object.values(languages).some(entries => entries.some(entry => entry.verified === 1)),
            duplicateCount: duplicateIds.length || 1,
            duplicateIds: duplicateIds.filter(id => id !== item.id),
        };
    });
};

interface PageFilter { where: string[]; params: (string | number)[] }

// Used by listing, forward and reverse search alike. The SQL page consists of
// lexeme/meaning pairs, in a total order even when a lexeme has many meanings.
async function fetchPage(offset: number, limit: number, filter: PageFilter): Promise<LexiconItem[]> {
    const db = await init();
    try {
        return db.transaction(() => {
            const data = db.prepare(`
                SELECT ${LEXEME_COLUMNS}, m.id AS meaningId, m.meaning AS meaningText,
                    m.examples, m.meaningVerified
                ${LEXEME_JOINS}
                LEFT JOIN meanings m ON m.lexemeId = l.id
                WHERE ${filter.where.length ? filter.where.join(' AND ') : '1 = 1'}
                GROUP BY l.id, m.id
                ORDER BY l.id ASC, m.id ASC
                LIMIT ? OFFSET ?
            `).all(...filter.params, limit, offset) as LexemeRow[];
            return enrichLexemeRows(db, data);
        }).deferred();
    } finally {
        db.close();
    }
}

const likeParam = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

export const getDictItems = async (
    search: string,
    offset: number,
    limit: number,
    mainCategory?: string,
    usageType?: string,
    filterLang?: string,
    unverified?: boolean,
    includeHidden?: boolean,
    unverifiedMeanings?: boolean,
    unverifiedCore?: boolean,
    unverifiedNsl?: boolean,
): Promise<LexiconItem[]> => {
    validateLexiconPagination(offset, limit);
    const filter: PageFilter = { where: [], params: [] };
    if (!includeHidden) filter.where.push('l.isPublic = 1');
    if (mainCategory) { filter.where.push('l.mainCategory = ?'); filter.params.push(mainCategory); }
    if (usageType) { filter.where.push('l.usageType = ?'); filter.params.push(usageType); }
    if (unverifiedMeanings) filter.where.push('m.meaningVerified IS NOT 1');
    if (unverifiedCore) filter.where.push('la_core.verified IS NOT 1');
    if (unverifiedNsl) filter.where.push('la_nsl.verified IS NOT 1');
    if (filterLang && unverified && TRANSLATION_LANGUAGE_CODES.some(lang => lang === filterLang)) {
        filter.where.push(`EXISTS (SELECT 1 FROM translations review_t
            WHERE review_t.meaningId = m.id AND review_t.language = ? AND review_t.verified IS NOT 1)`);
        filter.params.push(filterLang);
    }
    if (search) {
        // Trigram FTS supports 3+ characters; shorter strings use literal LIKE.
        // Search canonical and simplified forms together, deduplicating BEFORE
        // pagination rather than materializing every matched id in JS.
        const useFts = search.length >= 3;
        const folded = foldDiacritics(search);
        const variants = folded !== search ? [search, folded] : [search];
        const params = variants.map(value => useFts ? `"${value.replace(/"/g, '""')}"` : likeParam(value));
        const op = useFts ? 'MATCH ?' : "LIKE ? ESCAPE '\\'";
        const orGroup = (column: string) => `(${params.map(() => `${column} ${op}`).join(' OR ')})`;
        filter.where.push(`(l.id IN (SELECT ROWID FROM lexemes_text WHERE ${orGroup('value')})
            OR EXISTS (SELECT 1 FROM lexeme_allophones la
                WHERE la.lexemeId = l.id
                  AND la.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
                  AND la.type = 'standard'
                  AND la.id IN (SELECT ROWID FROM lexeme_allophones_text WHERE ${orGroup('value')})))`);
        filter.params.push(...params, ...params);
    }
    return fetchPage(offset, limit, filter);
};

export const getReverseDictItems = async (
    search: string,
    language: string,
    offset: number,
    limit: number,
    includeHidden?: boolean,
): Promise<LexiconItem[]> => {
    validateLexiconPagination(offset, limit);
    if (!search || !language) return [];
    // Preserve reverse search's lexeme-level match: all meanings of a matched
    // lexeme remain visible, but each displayed row counts toward the limit.
    const filter: PageFilter = {
        where: [`EXISTS (SELECT 1 FROM meanings reverse_m JOIN translations reverse_t ON reverse_t.meaningId = reverse_m.id
            WHERE reverse_m.lexemeId = l.id AND reverse_t.language = ? AND reverse_t.value LIKE ? ESCAPE '\\')`],
        params: [language, likeParam(search)],
    };
    if (!includeHidden) filter.where.push('l.isPublic = 1');
    return fetchPage(offset, limit, filter);
};
