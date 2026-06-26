import {init} from "@/lib/sqlite";

export const getRoots = async (rootId: string) => {
    const db = await init();

    const data = db.prepare(`
        select * from words where id IN (
            SELECT wordId FROM roots_words WHERE rootId = ?
        )
    `).all(rootId);

    return data ?? [];
};