import * as fs from 'fs';
import * as path from 'path';
const { PDFParse } = require('pdf-parse');

async function dumpPdfText() {
    const pdfUrl = 'https://www.sproghistorie.dk/files/olander-wordlist.pdf';

    console.log('1. Запуск современного PDF-парсера...');
    try {
        // Инициализируем парсер по вашему методу
        const parser = new PDFParse({ url: pdfUrl });

        console.log('2. Извлечение текста из удаленного архива...');
        const rawText = await parser.getText();

        // Сохраняем весь сырой текст в файл для анализа
        fs.writeFileSync('./raw_text.txt', rawText.text, 'utf-8');
        console.log('Сырой текст успешно сохранен в файл ./raw_text.txt');

        // Выведем первые 500 символов в консоль, чтобы сразу оценить верстку
        console.log('\n--- Первые 500 символов из PDF ---');
        console.log(rawText.text.substring(0, 500));
        console.log('---------------------------------');

    } catch (error: any) {
        console.error('Ошибка:', error.message);
    }
}

dumpPdfText();
