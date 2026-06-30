import * as fs from 'fs';
import * as path from 'path';
import {convertToInterslavic} from "@/lib/proto";

interface FinalLemmaRow {
    interslavic: string;
    protoSlavic: string;
    paradigm: 'A' | 'B' | 'C';
}

// Используем ваш рабочий современный синтаксис
const { PDFParse } = require('pdf-parse');

async function parseDerksenDictionary() {
    const pdfUrl = 'https://ia600508.us.archive.org/12/items/EtymologicalDictionaryOfTheSlavicInheritedLexicon_201310/179381168-Etymological-Dictionary-of-the-Slavic-Inherited-Lexicon.pdf';

    console.log('1. Запуск современного PDF-парсера...');
    try {
        // Инициализируем парсер по вашему методу
        const parser = new PDFParse({ url: pdfUrl });

        console.log('2. Извлечение текста из удаленного архива...');
        const rawText = (await parser.getText()).text;

        console.log('2. Анализ и сбор славянских лемм...');

        // const regex = /^\*([a-zA-Zěęǫъьščžytúíóāēōǭь́ъ́ь̈ъ̈]+)[^()]+?\(([abc])\)/gm;
        const regex = /\*([a-zA-Zěęǫъьščžytúíóāēōǭь́ъ́ь̈ъ̈]+)(?=[\s\S]{1,150}\(([abc])\))/g;

        const uniqueLemmas = new Map<string, 'A' | 'B' | 'C'>();
        let match;
        let totalCount = 0;

        while ((match = regex.exec(rawText)) !== null) {
            totalCount++;
            const word = match[1].toLowerCase();
            const paradigm = match[2].toUpperCase() as 'A' | 'B' | 'C';

            uniqueLemmas.set(word, paradigm);
        }


        const finalDatabase: FinalLemmaRow[] = Array.from(uniqueLemmas.entries()).map(([protoWord, paradigm]) => {
            return {
                interslavic: convertToInterslavic(protoWord),
                protoSlavic: protoWord,
                paradigm: paradigm
            };
        });

        finalDatabase.sort((a, b) => a.interslavic.localeCompare(b.interslavic));

        fs.writeFileSync('./dersen_accents.json', JSON.stringify(finalDatabase, null, 2), 'utf-8');

        console.log(`\nУспех! Распознано статей в книге: ${totalCount}`);
        console.log(`Уникальных праславянских корней собрано: ${uniqueLemmas.size}`);

        // Здесь данные можно сохранить в итоговый JSON-файл

    } catch (error: any) {
        console.error('Критическая ошибка:', error.message);
    }
}

parseDerksenDictionary();
