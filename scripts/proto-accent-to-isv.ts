import * as fs from 'fs';
import { convertToInterslavic } from '../lib/proto';

interface OlanderItem {
    protoSlavic: string;
    paradigm: 'A' | 'B' | 'C';
}

interface InterslavicDictionaryItem {
    interslavic: string;
    protoSlavic: string;
    paradigm: 'A' | 'B' | 'C';
}

function generateDictionary() {
    const rawData = fs.readFileSync('./olander_accents.json', 'utf-8');
    const olanderList: OlanderItem[] = JSON.parse(rawData);

    const dictionary: InterslavicDictionaryItem[] = [];

    for (const item of olanderList) {
        const interslavicWord = convertToInterslavic(item.protoSlavic);

        dictionary.push({
            interslavic: interslavicWord,
            protoSlavic: item.protoSlavic,
            paradigm: item.paradigm
        });
    }

    // Сортируем по междуславянскому алфавиту
    dictionary.sort((a, b) => a.interslavic.localeCompare(b.interslavic));

    fs.writeFileSync('./interslavic_accents_base.json', JSON.stringify(dictionary, null, 2), 'utf-8');
    console.log(`\nСловарь успешно сгенерирован! ${dictionary.length} слов сохранено в interslavic_accents_base.json`);
}

generateDictionary();
