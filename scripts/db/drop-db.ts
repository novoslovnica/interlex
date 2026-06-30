import dotenv from "dotenv";
import {prismaData as prisma} from "@/lib/prisma";
import path from "path";
import {init} from "@/lib/sqlite";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const createLangTable = (db, lang: string) => {
    db.exec(`-- DELETE FROM ${lang};`);
    db.exec(`DROP TABLE IF EXISTS ${lang};`);
};

const dropDb = async () => {
    const db = await init();

    db.exec('PRAGMA foreign_keys = OFF;');

    createLangTable(db, 'en');
    createLangTable(db, 'ru');
    createLangTable(db, 'mk');
    createLangTable(db, 'sr');
    createLangTable(db, 'uk');
    createLangTable(db, 'bg');
    createLangTable(db, 'pl');
    createLangTable(db, 'be');
    createLangTable(db, 'cs');
    createLangTable(db, 'sk');
    createLangTable(db, 'sl');
    createLangTable(db, 'hr');
    createLangTable(db, 'cu');
    createLangTable(db, 'de');
    createLangTable(db, 'nl');
    createLangTable(db, 'eo');

    db.exec(`-- DELETE FROM meanings;`);
    db.exec(`DROP TABLE IF EXISTS meanings;`);
    db.exec(`-- DELETE FROM roots_words;`);
    db.exec(`DROP TABLE IF EXISTS roots_words;`);
    db.exec(`-- DELETE FROM synonims;`);
    db.exec(`DROP TABLE IF EXISTS synonims;`);
    db.exec(`-- DELETE FROM antonims;`);
    db.exec(`DROP TABLE IF EXISTS antonims;`);
    // db.exec(`DELETE FROM words;`);
    db.exec(`DROP TABLE IF EXISTS words;`);
    // db.exec(`DELETE FROM roots;`);
    db.exec(`DROP TABLE IF EXISTS roots;`);
    db.exec(`-- DELETE FROM sqlite_sequence;`);

    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('VACUUM;');
};

(async () => {
    await dropDb();
})();
