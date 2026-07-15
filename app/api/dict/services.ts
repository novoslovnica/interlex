import {init} from "@/lib/sqlite";

export const getDictItems = async (search: string, from: string, to: string, mainCategory?: string, usageType?: string) => {
    const db = await init();

    const to_table = to;

    let from_table;
    switch (from) {
        case "ru":
            from_table = "ru";
            break;
        case "en":
            from_table = "en";
            break;
        default:
            from_table = "words";
    }

    let res = [];

    if (from_table === "words") {
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

        const foreignKeysArray = lexemeIds.map(r => r.id);
        if (foreignKeysArray.length === 0) return [];

        const placeholders = foreignKeysArray.map(() => '?').join(', ');

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

        const lexemes = db.prepare(`
            SELECT l.* FROM lexemes l WHERE l.id IN (${placeholders})${filterClause}
        `).all(...foreignKeysArray, ...filterParams) as any[];

        const translations = db.prepare(`
            SELECT * FROM ${to_table} WHERE wordId IN (${placeholders})
        `).all(...foreignKeysArray) as any[];

        res = translations.map(item => ({
            ...item,
            target: lexemes.find(el => el.id === item.wordId),
        })).filter(item => item.target);
    } else {
        const data = db.prepare(`
            SELECT *
            FROM ${from_table}
            WHERE ROWID IN (SELECT ROWID FROM ${from_table}_text WHERE value LIKE '%${search}%' ORDER BY rank)`)
            .all() as any[];

        const foreignKeysArray = data.map(item => item.wordId);
        const placeholders = foreignKeysArray.map(() => '?').join(', ');

        let filterClause = '';
        const filterParams: any[] = [];
        if (mainCategory) {
            filterClause += ' AND mainCategory = ?';
            filterParams.push(mainCategory);
        }
        if (usageType) {
            filterClause += ' AND usageType = ?';
            filterParams.push(usageType);
        }

        const lexemeRows = db.prepare(`
            SELECT * FROM lexemes WHERE id IN (${placeholders})${filterClause}
        `).all(...foreignKeysArray, ...filterParams) as any[];

        res = lexemeRows.map(item => ({
            ...item,
            target: data.find(el => el.wordId === item.id),
        }));
    }

    const allLexemeIds = res.map(item => {
        if (from_table === "words") return item.target?.id;
        return item.id;
    }).filter(Boolean);

    if (allLexemeIds.length > 0) {
        const idPlaceholders = allLexemeIds.map(() => '?').join(',');
        const allophoneRows = db.prepare(`
            SELECT la.lexemeId, la.value, af.code AS flavorCode, la.type
            FROM lexeme_allophones la
            JOIN allophone_flavors af ON af.id = la.flavorId
            WHERE la.lexemeId IN (${idPlaceholders})
        `).all(...allLexemeIds) as { lexemeId: number; value: string; flavorCode: string; type: string }[];

        const allophonesByLexeme: Record<number, { value: string; flavorCode: string; type: string }[]> = {};
        for (const row of allophoneRows) {
            if (!allophonesByLexeme[row.lexemeId]) allophonesByLexeme[row.lexemeId] = [];
            allophonesByLexeme[row.lexemeId].push({ value: row.value, flavorCode: row.flavorCode, type: row.type });
        }

        for (const item of res) {
            const isTarget = from_table === "words";
            const lexemeObj = isTarget ? item.target : item;
            if (lexemeObj) {
                const lexemeAllophones = allophonesByLexeme[lexemeObj.id] || [];
                const word = lexemeAllophones.find(a => a.flavorCode === 'CORE' && a.type === 'standard') || null;
                lexemeObj.word = word;
                lexemeObj.allophones = lexemeAllophones;
            }
        }
    }

    return res;
};