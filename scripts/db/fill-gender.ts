import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'interlex.db');

const MASC = 'MASC';
const FEM = 'FEM';
const NEUT = 'NEUT';

function inferGender(value: string): string | null {
  const word = value.includes(' ') ? value.split(' ').pop()! : value;
  const last = word.slice(-1);

  if (last === 'a' || last === 'å') return FEM;
  if (last === 'o') return NEUT;
  if (last === 'e') return NEUT;
  if (last === 'ę') return NEUT;
  if (last === 'j') return FEM;
  if (last === 'u') return MASC;
  if (/[bcdfghklmnprstvwxyzžščńćđňľ]/.test(last)) return MASC;

  return null;
}

function main() {
  console.log('Заполнение gender для существительных по эвристике окончания\n');

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const rows = db.prepare(`
    SELECT id, value, gender, paradigm
    FROM lexemes
    WHERE pos IN ('NOUN', 'noun')
      AND (gender IS NULL OR gender = '')
  `).all() as { id: number; value: string; gender: string | null; paradigm: string | null }[];

  if (rows.length === 0) {
    console.log('Нет существительных без gender. Готово.');
    return;
  }

  const update = db.prepare('UPDATE lexemes SET gender = ? WHERE id = ?');

  const stats = { fem: 0, masc: 0, neut: 0, skipped: 0 };

  const tx = db.transaction(() => {
    for (const row of rows) {
      const inferred = inferGender(row.value);
      if (!inferred) {
        stats.skipped++;
        console.log(`  Не удалось определить: id=${row.id} value="${row.value}"`);
        continue;
      }
      update.run(inferred, row.id);
      if (inferred === FEM) stats.fem++;
      else if (inferred === MASC) stats.masc++;
      else if (inferred === NEUT) stats.neut++;
    }
  });

  tx();

  console.log(`\nРезультаты (всего обработано: ${rows.length}):`);
  console.log(`  Женский род (FEM):   ${stats.fem}`);
  console.log(`  Мужской род (MASC):  ${stats.masc}`);
  console.log(`  Средний род (NEUT):  ${stats.neut}`);
  console.log(`  Пропущено:           ${stats.skipped}`);
  console.log('\nГотово.');
}

main();