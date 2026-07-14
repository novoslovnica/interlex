import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'interlex.db');

const MASC = 'MASC';
const FEM = 'FEM';
const NEUT = 'NEUT';

const SOFT_CONSONANTS = new Set(['č', 'š', 'ž', 'ć', 'đ', 'j', 'c', 'ň', 'ľ', 'lj', 'nj']);
const U_STEMS = new Set(['syn', 'dom', 'vol', 'pol', 'med', 'verh', 'čin', 'polk', 'dar',
  'synъ', 'domъ', 'volъ', 'polъ', 'medъ', 'verhъ', 'činъ', 'polkъ', 'darъ',
  'medь', 'polkь']);
const S_STEMS = new Set(['nebo', 'slovo', 'tělo', 'čudo', 'kolo', 'oko', 'uho', 'drevo',
  'nebes', 'sloves', 'těles', 'čudes', 'koles', 'okes', 'uhes', 'dreves']);

function getEnding(word: string): string | null {
  for (const e of ['ę', 'a', 'o', 'e']) {
    if (word.endsWith(e)) return e;
  }
  return null;
}

function getLastConsonantClass(word: string): 'soft' | 'hard' {
  const ch = word.slice(-2);
  if (SOFT_CONSONANTS.has(ch)) return 'soft';
  if (SOFT_CONSONANTS.has(word.slice(-1))) return 'soft';
  return 'hard';
}

function inferGender(word: string): string | null {
  const last = word.slice(-1);
  if (last === 'a') return FEM;
  if (last === 'o') return NEUT;
  if (last === 'e') {
    if (word.endsWith('išče') || word.endsWith('stvo')) return NEUT;
    return NEUT;
  }
  if (last === 'ę') return NEUT;
  if (word.endsWith('ost') || word.endsWith('zn') || word.endsWith('ń') || last === 'j') return FEM;
  if (/[bcdfghklmnprstvwxyz]/.test(last)) return MASC;
  return null;
}

function classifyNoun(value: string, gender: string | null): {
  protoStemClass: string;
  stemExtension?: string;
} | null {
  const lastWord = value.includes(' ') ? value.split(' ').pop()! : value;

  if (U_STEMS.has(lastWord)) {
    return { protoStemClass: 'u' };
  }

  if (S_STEMS.has(lastWord)) {
    return { protoStemClass: 'consonant', stemExtension: 'es' };
  }

  const resolvedGender = gender || inferGender(lastWord);
  if (!resolvedGender) return null;

  const ending = getEnding(lastWord);

  if (resolvedGender === FEM) {
    if (ending === 'a') {
      const cc = getLastConsonantClass(lastWord.slice(0, -1));
      return { protoStemClass: cc === 'soft' ? 'jā' : 'ā' };
    }
    return { protoStemClass: 'i' };
  }

  if (resolvedGender === MASC) {
    if (!ending) {
      const cc = getLastConsonantClass(lastWord);
      return { protoStemClass: cc === 'soft' ? 'jo' : 'o' };
    }
    if (ending === 'o') {
      const cc = getLastConsonantClass(lastWord.slice(0, -1));
      return { protoStemClass: cc === 'soft' ? 'jo' : 'o' };
    }
    if (ending === 'e') {
      return { protoStemClass: 'jo' };
    }
    if (ending === 'a') {
      const cc = getLastConsonantClass(lastWord.slice(0, -1));
      return { protoStemClass: cc === 'soft' ? 'jā' : 'ā' };
    }
    return { protoStemClass: 'o' };
  }

  if (resolvedGender === NEUT) {
    if (ending === 'o') {
      return { protoStemClass: 'o' };
    }
    if (ending === 'e') {
      return { protoStemClass: 'jo' };
    }
    if (ending === 'ę') {
      if (lastWord.endsWith('telę')) {
        return { protoStemClass: 'consonant', stemExtension: 'ent' };
      }
      return { protoStemClass: 'consonant', stemExtension: 'en' };
    }
    if (!ending) {
      const cc = getLastConsonantClass(lastWord);
      return { protoStemClass: cc === 'soft' ? 'jo' : 'o' };
    }
    if (ending === 'a') {
      const cc = getLastConsonantClass(lastWord.slice(0, -1));
      return { protoStemClass: cc === 'soft' ? 'jā' : 'ā' };
    }
    return { protoStemClass: 'o' };
  }

  return null;
}

function main() {
  console.log('Noun stem classifier — заполнение protoStemClass для существительных\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const rows = db.prepare(`
    SELECT id, value, gender, protoStemClass, paradigm
    FROM lexemes
    WHERE pos IN ('NOUN', 'noun')
      AND (properNoun = 0 OR properNoun IS NULL)
      AND (protoStemClass IS NULL OR protoStemClass = '')
  `).all() as { id: number; value: string; gender: string | null; protoStemClass: string | null; paradigm: string | null }[];

  console.log(`Всего существительных для обработки: ${rows.length}`);
  const withGender = rows.filter(r => r.gender);
  const withoutGender = rows.filter(r => !r.gender);
  console.log(`  с заданным gender: ${withGender.length}`);
  console.log(`  без gender: ${withoutGender.length}\n`);

  const update = db.prepare(`
    UPDATE lexemes
    SET protoStemClass = ?,
        paradigm = COALESCE(paradigm, 'A'),
        stemExtension = COALESCE(stemExtension, ?)
    WHERE id = ?
  `);

  let updated = 0;
  let skipped_no_gender = 0;
  let skipped_other: string[] = [];

  const BATCH = 100;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const result = classifyNoun(row.value, row.gender);
      if (!result) {
        skipped_no_gender++;
        continue;
      }
      const stemExt = result.stemExtension || null;
      update.run(result.protoStemClass, stemExt, row.id);
      updated++;
    }
  });

  tx();

  console.log('Результаты:');
  console.log(`  Обновлено: ${updated}`);
  console.log(`  Пропущено (не удалось определить род): ${skipped_no_gender}`);
  if (skipped_other.length) {
    console.log(`  Прочие пропуски: ${skipped_other.join(', ')}`);
  }
  console.log('\nГотово.');
}

main();