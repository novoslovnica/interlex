import {init} from "@/lib/sqlite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const createLangTable = async (lang: string) => {
    const db = await init();

    await db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE if exists ${lang};
        PRAGMA foreign_keys = ON;
    `);
};

const dropDb = async () => {
    const db = await init();

    await db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE if exists words;
        PRAGMA foreign_keys = ON;
    `);
    await db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE if exists roots;
        PRAGMA foreign_keys = ON;
    `);
    await db.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE if exists roots_words;
        PRAGMA foreign_keys = ON;
    `);

    await createLangTable('en');
    await createLangTable('ru');
    await createLangTable('mk');
    await createLangTable('sr');
    await createLangTable('uk');
    await createLangTable('bg');
    await createLangTable('pl');
    await createLangTable('be');
    await createLangTable('cs');
    await createLangTable('sk');
    await createLangTable('sl');
    await createLangTable('hr');
    await createLangTable('cu');
    await createLangTable('de');
    await createLangTable('nl');
    await createLangTable('eo');
};

(async () => {
    await dropDb();
})();
