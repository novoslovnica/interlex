import * as fs from 'fs';
import * as path from 'path';

interface QuarryRow {
  lemma: string;
  paradigm: string;
}

interface FinalLemma {
  protoSlavic: string;
  paradigm: 'A' | 'B' | 'C';
}

function compileDatabase() {
  const inputPath = path.resolve('./quarry_result.json');
  const outputPath = path.resolve('./proto_compiled_accents.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`Ошибка: Файл ${inputPath} не найден. Сначала скачайте его из Quarry!`);
    return;
  }

  // Читаем сырой ответ Quarry
  const fileContent = fs.readFileSync(inputPath, 'utf-8');
  const rawData = JSON.parse(fileContent);

  // Структура Quarry JSON содержит массив строк в поле "rows"
  // Где row[0] — это лемма, а row[1] — буква парадигмы (a, b, c)
  const rows: any[][] = rawData.rows || [];
  const finalDatabase: FinalLemma[] = [];

  for (const row of rows) {
    if (row && row.length >= 2) {
      const rawLemma = row[0];
      const rawParadigm = row[1];

      // Очищаем префикс Reconstruction, если он остался в базе
      const cleanLemma = rawLemma.replace('Reconstruction:Proto-Slavic/', '');

      finalDatabase.push({
        protoSlavic: cleanLemma,
        paradigm: rawParadigm.toUpperCase() as 'A' | 'B' | 'C'
      });
    }
  }

  // Сортируем по алфавиту
  finalDatabase.sort((a, b) => a.protoSlavic.localeCompare(b.protoSlavic));

  // Сохраняем финальный файл
  fs.writeFileSync(outputPath, JSON.stringify(finalDatabase, null, 2), 'utf-8');

  console.log('=========================================');
  console.log(`Успех! База данных успешно сформирована.`);
  console.log(`Всего обработано лемм: ${finalDatabase.length}`);
  console.log(`Файл сохранен: ${outputPath}`);
  console.log('=========================================');
}

compileDatabase();
