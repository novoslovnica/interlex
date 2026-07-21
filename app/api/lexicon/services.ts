import {init} from "@/lib/sqlite";

interface LangRecord {
    id: number;
    value: string | null;
    veryfied: number | null;
    wordId: number | null;
    meaningId: number | null;
}

export const getLangDataAll = (db, lang: string, meaningIds: number[]): Record<number, LangRecord[]> => {
    if (meaningIds.length === 0) return {};
    const placeholders = meaningIds.map(() => '?').join(', ');
    const rows = db.prepare(`
        SELECT * FROM ${lang} WHERE meaningId IN (${placeholders})
    `).all(...meaningIds) as LangRecord[];

    const grouped: Record<number, LangRecord[]> = {};
    for (const row of rows) {
        const key = row.meaningId;
        if (key == null) continue;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
    }
    return grouped;
};

export const getDictItems = async (
    search: string,
    offset: number,
    limit: number,
    mainCategory?: string,
    usageType?: string,
    filterLang?: string,
    unverified?: boolean,
) => {
    const db = await init();

    let data: any[] = [];

    if (search) {
        const lexemeIds = db.prepare(`
            SELECT DISTINCT l.id FROM lexemes l
            WHERE (
                l.id IN (SELECT ROWID FROM lexemes_text WHERE value LIKE '%${search}%')
                OR EXISTS (
                    SELECT 1 FROM lexeme_allophones la
                    WHERE la.lexemeId = l.id
                    AND la.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
                    AND la.type = 'standard'
                    AND la.id IN (SELECT ROWID FROM lexeme_allophones_text WHERE value LIKE '%${search}%')
                )
            )
        `).all() as { id: number }[];

        const ids = lexemeIds.map(r => r.id);
        if (ids.length === 0) return [];

        const placeholders = ids.map(() => '?').join(',');

        data = db.prepare(`
            SELECT l.id, la_core.value AS isv, la_nsl.value AS nsl, l.value, l.slug, l.stem, l.pos, l.gender,
                   l.declension, l.conjugation, l.transcription,
                   l.aspect, l.transitivity, l.animacy, l.degree,
                   l.pronType, l.numType, l.frequency, l.intelligibility,
                   l.addition, l.sameInLanguages, l.etymology, l.proto,
                   l.paradigm, l.protoStemClass, l.stemExtension, l.genesis,
                   l.secondaryStem, l.tertiaryStem, l.governsCase,
                   l.hasAnomalies, l.mainCategory, l.usageType
            FROM lexemes l
            LEFT JOIN lexeme_allophones la_core ON la_core.lexemeId = l.id AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE') AND la_core.type = 'standard'
            LEFT JOIN lexeme_allophones la_nsl ON la_nsl.lexemeId = l.id AND la_nsl.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'NSL') AND la_nsl.type = 'standard'
            WHERE l.id IN (${placeholders})
            GROUP BY l.id
        `).all(...ids) as any[];
    } else {
        let filterClause = '';
        const filterParams: any[] = [];
        if (mainCategory) {
            filterClause += ' WHERE l.mainCategory = ?';
            filterParams.push(mainCategory);
        }
        if (usageType) {
            filterClause += filterClause ? ' AND l.usageType = ?' : ' WHERE l.usageType = ?';
            filterParams.push(usageType);
        }

        data = db.prepare(`
            SELECT l.id, la_core.value AS isv, la_nsl.value AS nsl, l.value, l.slug, l.stem, l.pos, l.gender,
                   l.declension, l.conjugation, l.transcription,
                   l.aspect, l.transitivity, l.animacy, l.degree,
                   l.pronType, l.numType, l.frequency, l.intelligibility,
                   l.addition, l.sameInLanguages, l.etymology, l.proto,
                   l.paradigm, l.protoStemClass, l.stemExtension, l.genesis,
                   l.secondaryStem, l.tertiaryStem, l.governsCase,
                   l.hasAnomalies, l.mainCategory, l.usageType
            FROM lexemes l
            LEFT JOIN lexeme_allophones la_core ON la_core.lexemeId = l.id AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE') AND la_core.type = 'standard'
            LEFT JOIN lexeme_allophones la_nsl ON la_nsl.lexemeId = l.id AND la_nsl.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'NSL') AND la_nsl.type = 'standard'
            ${filterClause}
            GROUP BY l.id
            ORDER BY l.id ASC
            LIMIT ${limit} OFFSET ${offset}
        `).all(...filterParams);
    }

    const langCodes = ["en", "ru", "mk", "sr", "bg", "pl", "cs", "sl", "de", "uk", "be", "sk", "hr", "hsb", "dsb", "cu", "nl", "eo"];

    let allLangData: Record<string, Record<number, LangRecord[]>> = {};
    let res: any[];

    const lexemeIds = data.map(item => item.id).filter(Boolean);
    let allMeaningIds: number[] = [];
    const lexemeToMeanings: Record<number, number[]> = {};
    const meaningMap: Record<number, { id: number; meaning: string | null; examples: string | null }> = {};
    if (lexemeIds.length > 0) {
        const idPlaceholders = lexemeIds.map(() => '?').join(',');
        const meaningRows = db.prepare(`
            SELECT id, lexemeId, meaning, examples FROM meanings WHERE lexemeId IN (${idPlaceholders})
        `).all(...lexemeIds) as { id: number; lexemeId: number; meaning: string | null; examples: string | null }[];

        for (const row of meaningRows) {
            allMeaningIds.push(row.id);
            if (!lexemeToMeanings[row.lexemeId]) lexemeToMeanings[row.lexemeId] = [];
            lexemeToMeanings[row.lexemeId].push(row.id);
            meaningMap[row.id] = { id: row.id, meaning: row.meaning, examples: row.examples };
        }
    }

    for (const lang of langCodes) {
        allLangData[lang] = getLangDataAll(db, lang, allMeaningIds);
    }

    res = data.flatMap(item => {
        const meaningIds = lexemeToMeanings[item.id] || [];
        if (meaningIds.length === 0) {
            const result: any = { ...item, meaningId: null, meaningText: null, examples: null };
            for (const lang of langCodes) {
                result[lang] = [];
            }
            return [result];
        }
        return meaningIds.map(mid => {
            const m = meaningMap[mid];
            const result: any = { ...item, meaningId: m.id, meaningText: m.meaning, examples: m.examples };
            for (const lang of langCodes) {
                result[lang] = allLangData[lang][mid] || [];
            }
            return result;
        });
    });

    if (filterLang && unverified && langCodes.includes(filterLang)) {
        res = res.filter(item => {
            const langEntries = item[filterLang] as LangRecord[];
            return langEntries.length > 0 && langEntries.some(entry => entry.veryfied !== 1);
        });
    }

    const resLexemeIds = [...new Set(res.map(item => item.id).filter(Boolean))];
    if (resLexemeIds.length > 0) {
        const idPlaceholders = resLexemeIds.map(() => '?').join(',');
        const allophoneRows = db.prepare(`
            SELECT la.lexemeId, la.value, af.code AS flavorCode, la.type
            FROM lexeme_allophones la
            JOIN allophone_flavors af ON af.id = la.flavorId
            WHERE la.lexemeId IN (${idPlaceholders})
        `).all(...resLexemeIds) as { lexemeId: number; value: string; flavorCode: string; type: string }[];

        const allophonesByLexeme: Record<number, { value: string; flavorCode: string; type: string }[]> = {};
        for (const row of allophoneRows) {
            if (!allophonesByLexeme[row.lexemeId]) allophonesByLexeme[row.lexemeId] = [];
            allophonesByLexeme[row.lexemeId].push({ value: row.value, flavorCode: row.flavorCode, type: row.type });
        }

        for (const item of res) {
            const lexemeAllophones = allophonesByLexeme[item.id] || [];
            const word = lexemeAllophones.find(a => a.flavorCode === 'CORE' && a.type === 'standard') || null;
            item.word = word;
            item.allophones = lexemeAllophones;
        }
    }

    const allValues = res.map(item => item.value).filter(Boolean) as string[];
    const duplicateMap: Record<string, { count: number; ids: number[] }> = {};
    if (allValues.length > 0) {
        const valuePlaceholders = allValues.map(() => '?').join(',');
        const dupRows = db.prepare(`
            SELECT id, value FROM lexemes WHERE value IN (${valuePlaceholders})
        `).all(...allValues) as { id: number; value: string }[];
        for (const row of dupRows) {
            if (!duplicateMap[row.value]) duplicateMap[row.value] = { count: 0, ids: [] };
            duplicateMap[row.value].count++;
            duplicateMap[row.value].ids.push(row.id);
        }
    }

    for (const item of res) {
        const langEntries = langCodes.flatMap(lang => item[lang] as LangRecord[]);
        item.verified = langEntries.some(entry => entry.veryfied === 1);

        const dup = item.value ? duplicateMap[item.value] : undefined;
        item.duplicateCount = dup ? dup.count : 1;
        item.duplicateIds = dup ? dup.ids.filter((id: number) => id !== item.id) : [];
    }

    return res;
};