import { Case, NumberType, StemType, SLAVIC_ENDINGS_REGISTRY } from './endingsRegistry';
import { buildGrammeme } from './grammemes';

type EndingCacheKey = `${StemType}:${string}:${string}`;

const endingCache = new Map<EndingCacheKey, string>();

export function loadEndingOverridesSync(rows: { stemType: string; grammeme: string; value: string; flavorCode: string }[]): void {
  for (const row of rows) {
    const key = `${row.stemType}:${row.grammeme}:${row.flavorCode}` as EndingCacheKey;
    endingCache.set(key, row.value);
  }
}

export function getEnding(
  stemType: StemType,
  number: NumberType,
  c: Case,
  flavor: string = 'CORE',
  gender?: string,
  animacy?: string,
): string {
  const tryGrammeme = (g: string): string | undefined =>
    endingCache.get(`${stemType}:${g}:${flavor}` as EndingCacheKey);

  const fullGrammeme = buildGrammeme(c, number, gender, animacy);
  const dbValue = tryGrammeme(fullGrammeme);
  if (dbValue !== undefined) return dbValue;

  if (gender || animacy) {
    const genderGrammeme = buildGrammeme(c, number, gender);
    const dbGender = tryGrammeme(genderGrammeme);
    if (dbGender !== undefined) return dbGender;
  }

  const baseGrammeme = buildGrammeme(c, number);
  const dbBase = tryGrammeme(baseGrammeme);
  if (dbBase !== undefined) return dbBase;

  return SLAVIC_ENDINGS_REGISTRY[stemType][number][c];
}

export function resetEndingCache(): void {
  endingCache.clear();
}