import { isvToTranscription } from "@/lib/isv";
import { levenshtein } from "@/lib/levenshtein";

// Поиск по рифме/созвучию (roadmap п.43) - строится поверх уже готовой
// isvToTranscription (чистая, синхронная, без ударений/границ слогов), а не
// нового отдельного анализатора. Полноценной рифмы (от последнего ударного
// слога) эта транскрипция не даёт - используем практичное приближение:
// "рифмующаяся часть" = хвост IPA-строки от последней гласной. Лексикон
// небольшой (~24 тыс. слов), а сама транскрипция - чистые regex-операции,
// так что считаем на лету при каждом запросе и держим в module-level
// кэше с TTL, вместо отдельной колонки/таблицы и фонового скрипта.

// Базовые гласные символы, которые isvToTranscription кладёт в вывод (см.
// lib/isv.ts:238-250). Носовые ę/ǫ/ų превращаются в ɛ̃/ɔ̃ - комбинирующая
// тильда идёт СЛЕДОМ за базовым символом, так что поиск по базовому символу
// корректно находит и назальные гласные тоже.
const IPA_VOWELS = new Set(["a", "i", "u", "ɛ", "ɔ"]);

export interface RhymeEntry {
  id: number;
  value: string;
  ipa: string;
  key: string;
}

function lastVowelIndex(ipaInner: string, before = ipaInner.length): number {
  for (let i = before - 1; i >= 0; i--) {
    if (IPA_VOWELS.has(ipaInner[i])) return i;
  }
  return -1;
}

export function extractRhymeKey(ipaInner: string): string {
  const lastIdx = lastVowelIndex(ipaInner);
  if (lastIdx === -1) return ipaInner;

  // Открытый финальный слог (слово оканчивается прямо на гласную, без
  // коды) даёт вырожденный ключ из одной буквы - "a" совпадает почти со
  // всем словарём (nom.sg. ā-основ и т.п.), а не с реальной рифмой. В этом
  // случае расширяем ключ назад до предыдущей гласной, захватывая приступ
  // последнего слога - "posta" -> "sta", а не просто "a".
  if (lastIdx === ipaInner.length - 1) {
    const prevIdx = lastVowelIndex(ipaInner, lastIdx);
    if (prevIdx !== -1) return ipaInner.slice(prevIdx + 1);
  }

  return ipaInner.slice(lastIdx);
}

export function computeIpaAndKey(word: string): { ipa: string; key: string } {
  const bracketed = isvToTranscription(word);
  const inner = bracketed.slice(1, -1);
  return { ipa: bracketed, key: extractRhymeKey(inner) };
}

const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedIndex: RhymeEntry[] | null = null;
let cachedAt = 0;

// db: better-sqlite3 Database (см. lib/sqlite.ts) - тот же raw-SQL путь, что
// forward/reverse поиск лексикона (app/api/lexicon/services.ts), не Prisma.
export function getRhymeIndex(db: { prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] } }): RhymeEntry[] {
  const now = Date.now();
  if (cachedIndex && now - cachedAt < CACHE_TTL_MS) {
    return cachedIndex;
  }

  const rows = db.prepare(`
    SELECT l.id, l.value, la_core.value AS isv
    FROM lexemes l
    LEFT JOIN lexeme_allophones la_core
      ON la_core.lexemeId = l.id
      AND la_core.flavorId = (SELECT id FROM allophone_flavors WHERE code = 'CORE')
      AND la_core.type = 'standard'
    WHERE l.isPublic = 1 AND (l.value IS NOT NULL OR la_core.value IS NOT NULL)
  `).all() as { id: number; value: string | null; isv: string | null }[];

  cachedIndex = rows
    .map((row) => {
      const word = row.isv || row.value || "";
      if (!word) return null;
      const { ipa, key } = computeIpaAndKey(word);
      return { id: row.id, value: word, ipa, key } satisfies RhymeEntry;
    })
    .filter((r): r is RhymeEntry => r !== null);
  cachedAt = now;

  return cachedIndex;
}

export interface RhymeSearchResult {
  queryIpa: string;
  queryKey: string;
  exact: RhymeEntry[];
  similar: (RhymeEntry & { distance: number })[];
}

const NEAR_MATCH_LIMIT = 30;
const NEAR_MATCH_MAX_DISTANCE = 3;

export function searchRhymes(
  db: { prepare: (sql: string) => { all: (...args: unknown[]) => unknown[] } },
  queryWord: string,
): RhymeSearchResult {
  const { ipa: queryIpa, key: queryKey } = computeIpaAndKey(queryWord);
  const index = getRhymeIndex(db);

  const exact: RhymeEntry[] = [];
  const rest: RhymeEntry[] = [];
  for (const entry of index) {
    if (entry.key === queryKey) exact.push(entry);
    else rest.push(entry);
  }

  const similar = rest
    .map((entry) => ({ ...entry, distance: levenshtein(queryKey, entry.key) }))
    .filter((entry) => entry.distance <= NEAR_MATCH_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEAR_MATCH_LIMIT);

  return { queryIpa, queryKey, exact, similar };
}
