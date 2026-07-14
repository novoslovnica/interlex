import { loadEndingOverridesSync } from './lib/grammar/endingLoader';

export async function register() {
  try {
    const Database = (await import('better-sqlite3')).default;
    const dbPath = process.env.SQLITE_DB || './interlex.db';
    const db = new Database(dbPath);

    const rows = db
      .prepare(
        `SELECT e.stemType, e.grammeme, e.value, f.code AS flavorCode
         FROM ending_allophones e
         JOIN allophone_flavors f ON f.id = e.flavorId`
      )
      .all() as { stemType: string; grammeme: string; value: string; flavorCode: string }[];

    db.close();

    loadEndingOverridesSync(rows);
    console.log(`[instrumentation] Loaded ${rows.length} ending overrides into cache`);
  } catch (e) {
    console.warn('[instrumentation] Failed to load ending overrides:', (e as Error).message);
  }
}