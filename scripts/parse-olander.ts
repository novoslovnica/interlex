import * as fs from 'fs';

// Используем ваш правильный современный синтаксис библиотеки
const { PDFParse } = require('pdf-parse');

interface OlanderLemma {
    protoSlavic: string;
    paradigm: 'A' | 'B' | 'C';
}

async function downloadAndParseOlanderList() {
    const pdfUrl = 'https://www.sproghistorie.dk/files/olander-wordlist.pdf';

    console.log('1. Запуск современного PDF-парсера...');
    try {
        // Инициализируем парсер по вашему методу
        const parser = new PDFParse({ url: pdfUrl });

        console.log('2. Извлечение текста из удаленного архива...');
        const rawText = (await parser.getText()).text;

        console.log('3. Анализ лемм и акцентных парадигм Томаса Оландера...');

        // Регулярное выражение, учитывающее специфическую славянскую диакритику (яди, юсы, редуцированные)
        const regex = /^([a-zA-Zěęǫъьščžytúíóāēōǭь́ъ́ь̈ъ̈]+)(?:\s+-[a-zěęǫъьь́ъ́]+)?\s+([abcd])(?:\/([abc]))?/gm;

        const uniqueLemmas = new Map<string, 'A' | 'B' | 'C'>();
        let match;
        let totalMatches = 0;

        while ((match = regex.exec(rawText)) !== null) {
            totalMatches++;
            const word = match[1].toLowerCase();
            let rawParadigm = match[2].toLowerCase();

            let finalParadigm: 'A' | 'B' | 'C';

            // Конвертируем по системе Зализняка:
            // Парадигма d по Оландеру эквивалентна подвижной парадигме c
            if (rawParadigm === 'a') finalParadigm = 'A';
            else if (rawParadigm === 'b') finalParadigm = 'B';
            else finalParadigm = 'C'; // Сюда попадают 'c' и 'd'

            uniqueLemmas.set(word, finalParadigm);
        }

        const finalDatabase: OlanderLemma[] = Array.from(uniqueLemmas.entries()).map(([word, p]) => ({
            protoSlavic: word,
            paradigm: p
        }));

        // Алфавитная сортировка по славянским правилам
        finalDatabase.sort((a, b) => a.protoSlavic.localeCompare(b.protoSlavic));

        // Сохранение итогового файла
        fs.writeFileSync('./olander_accents.json', JSON.stringify(finalDatabase, null, 2), 'utf-8');

        console.log('\n=========================================');
        console.log(`Успех! Всего в тексте найдено совпадений: ${totalMatches}`);
        console.log(`Уникальных праславянских лемм сохранено: ${finalDatabase.length}`);
        console.log('Файл успешно записан в: ./olander_accents.json');
        console.log('=========================================');

    } catch (error: any) {
        console.error('Критическая ошибка при обработке:', error.message || error);
    }
}

downloadAndParseOlanderList();
