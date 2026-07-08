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

export const getDictItems = async (search: string, offset: number, limit: number, mainCategory?: string, usageType?: string) => {
    const db = await init();

    let data: any[] = [];

    if (search) {
        const lexemeIds = db.prepare(`
            SELECT id FROM lexemes WHERE ROWID IN (SELECT ROWID FROM lexemes_text WHERE value LIKE '%${search}%' ORDER BY rank)
        `).all() as { id: number }[];

        const ids = lexemeIds.map(r => r.id);
        if (ids.length === 0) return [];

        const placeholders = ids.map(() => '?').join(',');

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
                   l.id, l.nsl, l.isv, l.value, l.slug, l.stem, l.pos, l.gender,
                   l.declension, l.conjugation, l.transcription,
                   l.aspect, l.transitivity, l.animacy, l.degree,
                   l.pronType, l.numType, l.frequency, l.intelligibility,
                   l.addition, l.sameInLanguages, l.etymology, l.proto,
                   l.paradigm, l.protoStemClass, l.stemExtension, l.genesis,
l.secondaryStem, l.tertiaryStem, l.governsCase,
                   l.hasAnomalies, l.mainCategory, l.usageType
            FROM meanings m
            JOIN lexemes l ON m.lexemeId = l.id
            WHERE m.lexemeId IN (${placeholders})${filterClause}
            ORDER BY l.id ASC, m.id ASC
        `).all(...ids, ...filterParams);
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
                   l.id, l.nsl, l.isv, l.value, l.slug, l.stem, l.pos, l.gender,
                   l.declension, l.conjugation, l.transcription,
                   l.aspect, l.transitivity, l.animacy, l.degree,
                   l.pronType, l.numType, l.frequency, l.intelligibility,
                   l.addition, l.sameInLanguages, l.etymology, l.proto,
                   l.paradigm, l.protoStemClass, l.stemExtension, l.genesis,
l.secondaryStem, l.tertiaryStem, l.governsCase,
                   l.hasAnomalies, l.mainCategory, l.usageType
            FROM meanings m
            JOIN lexemes l ON m.lexemeId = l.id
            ${filterClause}
            ORDER BY l.id ASC, m.id ASC
            LIMIT ${limit} OFFSET ${offset}
        `).all(...filterParams);
    }

    const meaningIds: number[] = data.map(item => item.meaningId);
    const langCodes = ["en", "ru", "mk", "sr", "bg", "pl", "cs", "sl", "de", "uk", "be", "sk", "hr", "cu", "nl", "eo"];

    const allLangData: Record<string, Record<number, LangRecord[]>> = {};
    for (const lang of langCodes) {
        allLangData[lang] = getLangDataAll(db, lang, meaningIds);
    }

    const res = data.map(item => {
        const result: any = { ...item };
        for (const lang of langCodes) {
            result[lang] = allLangData[lang][item.meaningId] || [];
        }
        return result;
    });

    return res;
};