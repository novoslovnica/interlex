import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'interlex.db');
const CSV_PATH = path.resolve(process.cwd(), 'slovnik-2.csv');

function parseProperNounIds(): number[] {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n');
  const ids: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const firstComma = line.indexOf(',');
    if (firstComma === -1) continue;

    const idStr = line.slice(0, firstComma);
    const rest = line.slice(firstComma + 1);

    const secondComma = rest.indexOf(',');
    if (secondComma === -1) continue;

    const isv = rest.slice(0, secondComma);
    const firstChar = isv.trimStart().charAt(0);

    if (/[A-ZÅÄÖÜÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜČĆĎĚŇŘŠŤŽ]/.test(firstChar)) {
      ids.push(Number(idStr));
    }
  }

  return ids;
}

function main() {
  console.log('Простановка properNoun для имён собственных\n');

  const csvIds = parseProperNounIds();
  console.log(`Найдено в CSV: ${csvIds.length} слов с заглавной буквы`);

  if (csvIds.length === 0) {
    console.log('Нет ID для обработки. Готово.');
    return;
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const getLexemes = db.prepare(`
    SELECT id, value, external_id, properNoun
    FROM lexemes
    WHERE external_id = ?
  `);

  const update = db.prepare('UPDATE lexemes SET properNoun = 1 WHERE id = ?');

  const stats = { found: 0, alreadyTrue: 0, updated: 0, notFound: 0 };

  const tx = db.transaction(() => {
    for (const csvId of csvIds) {
      const row = getLexemes.get(csvId) as { id: number; value: string; external_id: number; properNoun: number } | undefined;
      if (!row) {
        stats.notFound++;
        continue;
      }
      stats.found++;
      if (row.properNoun === 1) {
        stats.alreadyTrue++;
        continue;
      }
      update.run(row.id);
      stats.updated++;
    }
  });

  tx();

  console.log(`\nРезультаты:`);
  console.log(`  Найдено в базе:     ${stats.found}`);
  console.log(`  Уже properNoun=1:   ${stats.alreadyTrue}`);
  console.log(`  Обновлено:          ${stats.updated}`);
  console.log(`  Не найдено в базе:  ${stats.notFound}`);
  console.log('\nГотово.');
}

main();