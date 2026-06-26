import {init} from "@/lib/sqlite";

export const getDictItems = async (search: string, from: string, to: string) => {
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

    const data = await db.prepare(`
        SELECT *
        FROM ${from_table}
        WHERE ROWID IN (SELECT ROWID FROM ${from_table}_text WHERE value LIKE '%${search}%' ORDER BY rank)`)
        .all();

    let res = [];

    if (from_table === "words") {
        const foreignKeysArray = data.map(item => item.id);
        const placeholders = foreignKeysArray.map(() => '?').join(', ');
        res = db.prepare(`
            SELECT * FROM ${to_table} WHERE wordId IN (${placeholders})
        `).all(...foreignKeysArray);

        res = res.map(item => ({
            ...item,
            target: data.find(el => el.id === item.wordId),
        }))
    } else {
        const foreignKeysArray = data.map(item => item.wordId);
        const placeholders = foreignKeysArray.map(() => '?').join(', ');
        res = db.prepare(`
            SELECT * FROM words WHERE id IN (${placeholders})
        `).all(...foreignKeysArray);

        res = res.map(item => ({
            ...item,
            target: data.find(el => el.wordId === item.id),
        }))
    }

    return res;
}