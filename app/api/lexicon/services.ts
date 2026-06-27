import {init} from "@/lib/sqlite";

export const getLangData = (db, lang, wordIds: string[], wordId) => {
    const placeholders = wordIds.map(() => '?').join(', ');

    const ens = db.prepare(`
            SELECT * FROM ${lang} WHERE wordId IN (${placeholders})
        `).all(...wordIds);

    return ens.find(el => el.wordId === wordId);
};

export const getDictItems = async (search: string, offset: number, limit: number) => {
    const db = await init();

    const from_table = "words";

    let data = [];
    if (search) {
        data = await db.prepare(`
        SELECT *
        FROM ${from_table}
        WHERE ROWID IN (SELECT ROWID FROM ${from_table}_text WHERE value LIKE '%${search}%' ORDER BY rank)
        ORDER BY "id" ASC
        LIMIT ${limit}
        OFFSET ${offset}
        `)
            .all();
    } else {
        data = await db.prepare(`
            SELECT *
            FROM ${from_table}
            ORDER BY "id" ASC
            LIMIT ${limit}
            OFFSET ${offset}
        `).all();
    }

    const foreignKeysArray = data.map(item => item.id);

    // const ens = db.prepare(`
    //         SELECT * FROM en WHERE wordId IN (${placeholders})
    //     `).all(...foreignKeysArray);

    const res = data.map(item => ({
        ...item,
        // en: ens.find(el => el.wordId === item.id),
        en: getLangData(db, "en", foreignKeysArray, item.id),
        ru: getLangData(db, "ru", foreignKeysArray, item.id),
        mk: getLangData(db, "mk", foreignKeysArray, item.id),
        sr: getLangData(db, "sr", foreignKeysArray, item.id),
        bg: getLangData(db, "bg", foreignKeysArray, item.id),
        pl: getLangData(db, "pl", foreignKeysArray, item.id),
        cs: getLangData(db, "cs", foreignKeysArray, item.id),
        sl: getLangData(db, "sl", foreignKeysArray, item.id),
        de: getLangData(db, "de", foreignKeysArray, item.id),
    }))

    return res;
}