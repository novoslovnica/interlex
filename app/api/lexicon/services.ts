import {init} from "@/lib/sqlite";

export const getDictItems = async (search: string, offset: number) => {
    const db = await init();

    const from_table = "words";

    let data = [];
    if (search) {
        data = await db.prepare(`
        SELECT *
        FROM ${from_table}
        WHERE ROWID IN (SELECT ROWID FROM ${from_table}_text WHERE value LIKE '%${search}%' ORDER BY rank)`)
            .all();
    } else {
        data = await db.prepare(`
            SELECT *
            FROM ${from_table}
            LIMIT 50
            OFFSET ${offset}
        `).all();
    }

    const foreignKeysArray = data.map(item => item.id);
    const placeholders = foreignKeysArray.map(() => '?').join(', ');

    const ens = db.prepare(`
            SELECT * FROM en WHERE wordId IN (${placeholders})
        `).all(...foreignKeysArray);

    const res = data.map(item => ({
        ...item,
        en: ens.find(el => el.wordId === item.id),
    }))

    return res;
}