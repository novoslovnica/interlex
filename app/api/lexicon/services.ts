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

export const getDictItems = async (search: string, offset: number, limit: number, mainCategory?: string, usageType?: string, filterLang?: string, unverified?: boolean, grouped?: boolean) => {
    const db = await init();

    let data: any[] = [];

    if (search) {
        const lexemeIds = db.prepare(`
            SELECT id FROM lexemes WHERE ROWID IN (SELECT ROWID FROM lexemes_text WHERE value LIKE '%${search}%' ORDER BY rank)
        `).all() as { id: number }[];

        const ids = lexemeIds.map(r => r.id);
        if (ids.length === 0) return [];

        const placeholders = ids.map(() => '?').join(',');

        if (grouped) {
            data = db.prepare(`
                SELECT l.id, о.value AS isv, la_nsl.value AS nsl, l.value, l.slug, l.stem, l.pos, l.gender,
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
                filterClause += ' AND l.mainCategory = ?';
                filterParams.push(mainCategory);
            }
            if (usageType) {
                filterClause += ' AND l.usageType = ?';
                filterParams.push(usageType);
            }

            data = db.prepare(`
                SELECT m.id AS meaningId, m.lexemeId, m.meaning AS meaningText, m.examples,
                       l.id, la_core.value AS isv, la_nsl.value AS nsl, l.value, l.slug, l.stem, l.pos, l.gender,
                       l.declension, l.conjugation, l.transcription,
                       l.aspect, l.transitivity, l.animacy, l.degree,
                       l.pronType, l.numType, l.frequency, l.intelligibility,
                       l.addition, l.sameInLanguages, l.etymology, l.proto,
                       l.paradigm, l.protoStemClass, l.stemExtension, l.genesis,
                       l.secondaryStem, l.tertiaryStem, l.governsCase,
                       l.hasAnomalies, l.mainCategory, l.usageType
                FROM meanings m
                JOIN lexemes l ON m.lexemeId = l.id
                LEFT JOIN lexeme_allophones la_core ON la_core.lexemeId = l.id AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE') AND la_core.type = 'standard'
                LEFT JOIN lexeme_allophones la_nsl ON la_nsl.lexemeId = l.id AND la_nsl.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'NSL') AND la_nsl.type = 'standard'
                WHERE m.lexemeId IN (${placeholders})${filterClause}
                ORDER BY l.id ASC, m.id ASC
            `).all(...ids, ...filterParams);
        }
    } else {
        if (grouped) {
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
                SELECT m.id AS meaningId, m.lexemeId, m.meaning AS meaningText, m.examples,
                       l.id, la_core.value AS isv, la_nsl.value AS nsl, l.value, l.slug, l.stem, l.pos, l.gender,
                       l.declension, l.conjugation, l.transcription,
                       l.aspect, l.transitivity, l.animacy, l.degree,
                       l.pronType, l.numType, l.frequency, l.intelligibility,
                       l.addition, l.sameInLanguages, l.etymology, l.proto,
                       l.paradigm, l.protoStemClass, l.stemExtension, l.genesis,
                       l.secondaryStem, l.tertiaryStem, l.governsCase,
                       l.hasAnomalies, l.mainCategory, l.usageType
                FROM meanings m
                JOIN lexemes l ON m.lexemeId = l.id
                LEFT JOIN lexeme_allophones la_core ON la_core.lexemeId = l.id AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE') AND la_core.type = 'standard'
                LEFT JOIN lexeme_allophones la_nsl ON la_nsl.lexemeId = l.id AND la_nsl.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'NSL') AND la_nsl.type = 'standard'
                ${filterClause}
                ORDER BY l.id ASC, m.id ASC
                LIMIT ${limit} OFFSET ${offset}
            `).all(...filterParams);
        }
    }

    const langCodes = ["en", "ru", "mk", "sr", "bg", "pl", "cs", "sl", "de", "uk", "be", "sk", "hr", "hsb", "dsb", "cu", "nl", "eo"];

    let allLangData: Record<string, Record<number, LangRecord[]>> = {};
    let res: any[];

    if (grouped) {
        const lexemeIds = data.map(item => item.id).filter(Boolean);
        let allMeaningIds: number[] = [];
        const lexemeToMeanings: Record<number, number[]> = {};
        if (lexemeIds.length > 0) {
            const idPlaceholders = lexemeIds.map(() => '?').join(',');
            const meaningRows = db.prepare(`
                SELECT id, lexemeId FROM meanings WHERE lexemeId IN (${idPlaceholders})
            `).all(...lexemeIds) as { id: number; lexemeId: number }[];
            for (const row of meaningRows) {
                allMeaningIds.push(row.id);
                if (!lexemeToMeanings[row.lexemeId]) lexemeToMeanings[row.lexemeId] = [];
                lexemeToMeanings[row.lexemeId].push(row.id);
            }
        }

        for (const lang of langCodes) {
            allLangData[lang] = getLangDataAll(db, lang, allMeaningIds);
        }

        res = data.map(item => {
            const result: any = { ...item };
            for (const lang of langCodes) {
                const langEntries: LangRecord[] = [];
                const meaningIds = lexemeToMeanings[item.id] || [];
                for (const mid of meaningIds) {
                    const entries = allLangData[lang][mid];
                    if (entries) langEntries.push(...entries);
                }
                result[lang] = langEntries;
            }
            return result;
        });
    } else {
        const meaningIds: number[] = data.map((item: any) => item.meaningId).filter(Boolean);

        for (const lang of langCodes) {
            allLangData[lang] = getLangDataAll(db, lang, meaningIds);
        }

        res = data.map((item: any) => {
            const result: any = { ...item };
            for (const lang of langCodes) {
                result[lang] = allLangData[lang][item.meaningId] || [];
            }
            return result;
        });
    }

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

    return res;
};