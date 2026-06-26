import Database from 'better-sqlite3';

export const init = async () => {
    const db = new Database(process.env.SQLITE_DB);

    return db;
}