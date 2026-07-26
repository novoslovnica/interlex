import {init} from "@/lib/sqlite";
import {fetchTranslationsForLexemeIds, type TranslationRow} from "@/lib/translations";

export const getDictItems = async (search: string, from: string, to: string, mainCategory?: string, usageType?: string) => {
    const db = await init();

    // `to` is now bound as a `language` parameter against the consolidated
    // translations table, never spliced into SQL as a table name.
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
        const searchPattern = `%${search}%`;
        const lexemeIds = db.prepare(`
            SELECT DISTINCT l.id FROM lexemes l
            WHERE (
                l.id IN (SELECT ROWID FROM lexemes_text WHERE value LIKE ?)
                OR EXISTS (
                    SELECT 1 FROM lexeme_allophones la
                    WHERE la.lexemeId = l.id
                    AND la.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
                    AND la.type = 'standard'
                    AND la.id IN (SELECT ROWID FROM lexeme_allophones_text WHERE value LIKE ?)
                )
            )
        `).all(searchPattern, searchPattern) as { id: number }[];

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
            SELECT l.* FROM lexemes l WHERE l.id IN (${placeholders}) AND l.isPublic = 1${filterClause}
        `).all(...foreignKeysArray, ...filterParams) as any[];

        // Every translation, in the target language, belonging to any meaning
        // of these lexemes — joined via meaningId -> Meaning.lexemeId (the
        // old wordId-based lookup here was already wrong for a meaningful
        // fraction of hsb/dsb and other rows, see AGENTS.md).
        const translations = fetchTranslationsForLexemeIds(db, foreignKeysArray, to_table);

        res = translations.map(item => ({
            ...item,
            target: lexemes.find(el => el.id === item.lexemeId),
        })).filter(item => item.target);
    } else {
        const searchPattern = `%${search}%`;
        const data = db.prepare(`
            SELECT * FROM translations WHERE language = ? AND value LIKE ?
        `).all(from_table, searchPattern) as TranslationRow[];

        const meaningIds = [...new Set(data.map(item => item.meaningId).filter((id): id is number => id != null))];
        const meaningToLexeme = new Map<number, number>();
        if (meaningIds.length > 0) {
            const mPlaceholders = meaningIds.map(() => '?').join(',');
            const meaningRows = db.prepare(`
                SELECT id, lexemeId FROM meanings WHERE id IN (${mPlaceholders})
            `).all(...meaningIds) as { id: number; lexemeId: number }[];
            for (const r of meaningRows) meaningToLexeme.set(r.id, r.lexemeId);
        }

        const foreignKeysArray = [...new Set(
            data.map(item => item.meaningId != null ? meaningToLexeme.get(item.meaningId) : undefined)
                .filter((id): id is number => id != null)
        )];
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

        const lexemeRows = foreignKeysArray.length > 0
            ? db.prepare(`
                SELECT * FROM lexemes WHERE id IN (${placeholders}) AND isPublic = 1${filterClause}
            `).all(...foreignKeysArray, ...filterParams) as any[]
            : [];

        res = lexemeRows.map(item => ({
            ...item,
            target: data.find(el => el.meaningId != null && meaningToLexeme.get(el.meaningId) === item.id),
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
