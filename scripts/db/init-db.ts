import {init} from "@/lib/sqlite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const createIndex = async (table: string, field: string) => {
    const db = await init();

    await db.exec(`
        CREATE VIRTUAL TABLE if not exists ${table}_text USING FTS5(${field}, content=${table})
    `);

    await db.exec(`
        CREATE TRIGGER if not exists ${table}_text_insert AFTER INSERT ON ${table}
        BEGIN
            INSERT INTO ${table}_text (rowid, ${field}) VALUES (new.rowid, new.${field});
        END;
        
        CREATE TRIGGER if not exists ${table}_text_delete AFTER DELETE ON ${table}
        BEGIN
            INSERT INTO ${table}_text (${table}_text, rowid, ${field}) VALUES ('delete', old.rowid, old.${field});
        END;
        
        CREATE TRIGGER if not exists ${table}_text_update AFTER UPDATE ON ${table}
        BEGIN
            INSERT INTO ${table}_text (${table}_text, rowid, ${field}) VALUES ('delete', old.rowid, old.${field});
            INSERT INTO ${table}_text (rowid, ${field}) VALUES (new.rowid, new.${field});
        END
    `);
}

const initDb = async () => {
    const db = await init();

    await db.exec(`
        create table if not exists words (
            id INTEGER primary key AUTOINCREMENT,
            external_id INTEGER,
            value TEXT,
            nsl TEXT,
            isv TEXT,
            transcription TEXT,
            field TEXT,
            declension INTEGER,
            etymology TEXT,
            genesis TEXT,
            type TEXT,
            pos TEXT,
            frequency TEXT,
            intelligibility TEXT,
            addition TEXT,
            sameInLanguages TEXT
        );
    `);

    await createIndex("words", "value");

    await db.exec(`
        create table if not exists meanings (
            id INTEGER primary key AUTOINCREMENT,
            wordId INTEGER NOT NULL,
            meaning TEXT,
            examples TEXT,
            foreign key (wordId) references words(id)
        );
    `);

    await db.exec(`
        create table if not exists roots (
            id INTEGER primary key AUTOINCREMENT,
            value TEXT,
            type INTEGER DEFAULT 0
        );
    `);

    await createIndex("roots", "value");

    await db.exec(`CREATE TABLE if not exists roots_words (
        id INTEGER primary key AUTOINCREMENT,
        wordId INTEGER,
        rootId INTEGER,
        foreign key (wordId) references words(id),
        foreign key (rootId) references roots(id)
    )`);

    await db.exec(`
        create table if not exists synonims (
            id INTEGER primary key AUTOINCREMENT,
            rootId INTEGER,
            wordId INTEGER,
            proximity REAL,
            foreign key (rootId) references words(id),
            foreign key (wordId) references words(id)
        );
    `);

    await db.exec(`
        create table if not exists antonims (
            id INTEGER primary key AUTOINCREMENT,
            rootId INTEGER,
            wordId INTEGER,
            proximity REAL,
            foreign key (rootId) references words(id),
            foreign key (wordId) references words(id)
        );
    `);

    const createLangTable = async (lang: string) => {
        await db.exec(`
            create table if not exists ${lang} (
                id INTEGER primary key AUTOINCREMENT,
                value TEXT,
                veryfied INTEGER,
                wordId INTEGER,
                meaningId INTEGER,
                foreign key (wordId) references meanings(id),
                foreign key (meaningId) references meanings(id)
            );
        `);

        await createIndex(lang, "value");
    };

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
    await initDb();
})();