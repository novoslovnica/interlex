import { Case, NumberType, StemType, SLAVIC_ENDINGS_REGISTRY } from './endingsRegistry';

type EndingCacheKey = `${StemType}:${NumberType}:${Case}:${string}`;

const endingCache = new Map<EndingCacheKey, string>();

function cacheKey(stemType: StemType, number: NumberType, c: Case, flavor: string): EndingCacheKey {
  return `${stemType}:${number}:${c}:${flavor}`;
}

export function loadEndingOverridesSync(rows: { stemType: string; grammeme: string; value: string; flavorCode: string }[]): void {
  for (const row of rows) {
    const numShort = row.grammeme.slice(0, 2);
    const caseShort = row.grammeme.slice(2);
    const key = cacheKey(
      row.stemType as StemType,
      numShort === 'Pl' ? 'plural' as NumberType
        : numShort === 'Du' ? 'dual' as NumberType
        : 'singular' as NumberType,
      caseShort === 'Acc' ? 'accusative' as Case
        : caseShort === 'Gen' ? 'genitive' as Case
        : caseShort === 'Dat' ? 'dative' as Case
        : caseShort === 'Ins' ? 'instrumental' as Case
        : caseShort === 'Loc' ? 'locative' as Case
        : caseShort === 'Voc' ? 'vocative' as Case
        : 'nominative' as Case,
      row.flavorCode,
    );
    endingCache.set(key, row.value);
  }
}

export function getEnding(
  stemType: StemType,
  number: NumberType,
  c: Case,
  flavor: string = 'CORE',
): string {
  const key = cacheKey(stemType, number, c, flavor);
  const dbValue = endingCache.get(key);
  if (dbValue !== undefined) return dbValue;
  return SLAVIC_ENDINGS_REGISTRY[stemType][number][c];
}

export function resetEndingCache(): void {
  endingCache.clear();
}