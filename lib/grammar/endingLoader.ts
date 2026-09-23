import { Case, NumberType } from './endingsRegistry';
import { SLAVIC_ENDINGS_REGISTRY, StemType } from './endingsRegistry';
import { buildGrammeme } from './grammemes';

type EndingCacheKey = `${string}:${string}:${string}`;

const endingCache = new Map<EndingCacheKey, string>();
let loadAttempted = false;

export function loadEndingOverridesSync(rows: { stemType: string; grammeme: string; value: string; flavorCode: string }[]): void {
  for (const row of rows) {
    const key = `${row.stemType}:${row.grammeme}:${row.flavorCode}` as EndingCacheKey;
    endingCache.set(key, row.value);
  }
}

function tryLoadFromDb(): void {
  if (loadAttempted || typeof window !== 'undefined') return;
  loadAttempted = true;
  try {
    const Database = require('better-sqlite3');
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
  } catch {
    // DB unavailable — fallback to hardcoded registries
  }
}

export function getEndingByGrammeme(
  stemType: string,
  grammeme: string,
  flavor: string = 'CORE',
): string | undefined {
  tryLoadFromDb();
  const key = `${stemType}:${grammeme}:${flavor}` as EndingCacheKey;
  return endingCache.get(key);
}

export function getEnding(
  stemType: string,
  number: NumberType,
  c: Case,
  flavor: string = 'CORE',
  gender?: string,
  animacy?: string,
): string {
  return findEnding(stemType, number, c, flavor, gender, animacy) ?? '';
}

/**
 * Как getEnding, но undefined, если окончания нет ни в БД, ни в реестре
 * существительных. Нужен тем, у кого свой запасной реестр (прилагательные):
 * getEnding отдаёт '' и `?? свой_реестр` не срабатывал - в браузере, где БД
 * нет, все формы прилагательного были голой основой ("dobr").
 */
export function findEnding(
  stemType: string,
  number: NumberType,
  c: Case,
  flavor: string = 'CORE',
  gender?: string,
  animacy?: string,
): string | undefined {
  const fullGrammeme = buildGrammeme(c, number, gender, animacy);
  const dbValue = getEndingByGrammeme(stemType, fullGrammeme, flavor);

  if (dbValue !== undefined) return dbValue;

  if (gender || animacy) {
    const genderGrammeme = buildGrammeme(c, number, gender);
    const dbGender = getEndingByGrammeme(stemType, genderGrammeme, flavor);
    if (dbGender !== undefined) return dbGender;
  }

  const baseGrammeme = buildGrammeme(c, number);
  const dbBase = getEndingByGrammeme(stemType, baseGrammeme, flavor);
  if (dbBase !== undefined) return dbBase;

  const stemTypeEnum = stemType as StemType;
  const registry = SLAVIC_ENDINGS_REGISTRY[stemTypeEnum];
  if (registry?.[number]?.[c] !== undefined) {
    return registry[number][c];
  }

  return undefined;
}

export function resetEndingCache(): void {
  endingCache.clear();
  loadAttempted = false;
}