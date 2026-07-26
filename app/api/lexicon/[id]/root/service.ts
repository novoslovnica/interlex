import {init} from "@/lib/sqlite";

export const getRoots = async (rootId: string) => {
    const db = await init();

    const data = db.prepare(`
        select * from lexemes where isPublic = 1 and id IN (
            SELECT lexemeId FROM lexemes_morphemes WHERE morphemeId = ?
        )
    `).all(rootId);

    return data ?? [];
};