import * as fs from 'fs';
import * as path from 'path';
import { declineWordAutomatically  } from './declineNoun';
import { identifyStemTypeByDb, EnhancedDbItem } from './stemClassifier';

// Загружаем нашу расширенную базу данных
const dbPath = path.resolve('./dersen_accents_2.json');
if (!fs.existsSync(dbPath)) {
    console.error(`Ошибка: База данных ${dbPath} не найдена. Сначала запустите компилятор!`);
    process.exit(1);
}

const database: EnhancedDbItem[] = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

// Вспомогательная функция для быстрого поиска слова в базе
function findInDb(interslavicWord: string, gender: string): EnhancedDbItem | undefined {
    return database.find(item => item.interslavic === interslavicWord && item.gender === gender);
}

/**
 * Генерирует красивую текстовую таблицу падежных форм для визуального контроля
 */
function validateWordParadigm(word: string, gender: 'masculine' | 'feminine' | 'neuter', preposition?: string) {
    const item = findInDb(word, gender);

    if (!item) {
        console.warn(`[Предупреждение] Слово "${word}" (${gender}) не найдено в собранной базе данных.`);
        return;
    }

    const stemType = identifyStemTypeByDb(item);

    console.log(`\n================================================================================`);
    console.log(`ВАЛИДАЦИЯ СЛОВА: "${item.interslavic.toUpperCase()}" (Праславянское: *${item.protoSlavic})`);
    console.log(`Парадигма Зализняка: [${item.paradigm}] | Исторический класс основы: [${item.protoStemClass}] (Внутренний: ${stemType})`);
    if (preposition) console.log(`Тестирование с предлогом: "${preposition}"`);
    console.log(`================================================================================`);
    console.log(`${'Падеж'.padEnd(12)} | ${'Единственное (Sg)'.padEnd(20)} | ${'Множественное (Pl)'.padEnd(20)} | ${'Двойственное (Du)'.padEnd(20)}`);
    console.log(`-`.repeat(80));

    const cases: ('nom' | 'acc' | 'gen' | 'dat' | 'ins' | 'loc')[] = [
        'nom', 'acc', 'gen', 'dat', 'ins', 'loc'
    ];

    const caseLabels: Record<string, string> = {
        nom: 'Именит. (Nom)',
        acc: 'Винит.  (Acc)',
        gen: 'Родит.  (Gen)',
        dat: 'Дател.  (Dat)',
        ins: 'Творит. (Ins)',
        loc: 'Местн.  (Loc)'
    };

    for (const c of cases) {
        // Генерируем формы для всех трёх чисел
        const sg = declineWordAutomatically({ dbItem: item, targetCase: c, targetNumber: 'singular', preposition });
        const pl = declineWordAutomatically({ dbItem: item, targetCase: c, targetNumber: 'plural', preposition });
        const du = declineWordAutomatically({ dbItem: item, targetCase: c, targetNumber: 'dual', preposition });

        console.log(`${caseLabels[c].padEnd(12)} | ${sg.padEnd(20)} | ${pl.padEnd(20)} | ${du.padEnd(20)}`);
    }
    console.log(`================================================================================\n`);
}

/**
 * Главный запуск валидатора
 */
function runValidationSuite() {
    console.log('=== ЗАПУСК ЛИНГВИСТИЧЕСКОГО ВАЛИДАТОРА ЧЕТЫРЕХ ТОНОВ ===\n');

    // Тест 1: Фундаментальная долгая подвижная парадигма C (Женский род, а-основа)
    // Ожидаем: Nom.Sg - долгий циркумфлекс (rų̂ka), Acc.Sg - перенос на предлог (nà rųkǫ), Nom.Pl - акут на конце (ruký)
    validateWordParadigm('ruka', 'feminine', 'na');

    // Тест 2: Краткая подвижная парадигма C (Женский род, а-основа)
    // Ожидаем: Nom.Sg - краткий циркумфлекс/дуга (goȓa), Acc.Sg - перенос на предлог (nà gorǫ)
    validateWordParadigm('gora', 'feminine', 'na');

    // Тест 3: Баритонная парадигма A (Ударение жестко на корне, никаких переносов)
    // Ожидаем: Везде акут на корне (rýba, rýby, na rýbǫ), предлог пустой
    validateWordParadigm('ryba', 'feminine', 'na');

    // Тест 4: Сложнейшее исключение - u-основа мужского рода (парадигма C)
    // Ожидаем: Автоматическое определение u_basis, Nom.Pl с суффиксом наращения (synóve)
    validateWordParadigm('syn', 'masculine');

    // Тест 5: Консонантная основа среднего рода (парадигма C, наращение на -s)
    // Ожидаем: Им.ед на корне (ně̂bo), во мн.ч наращение основы и прыжок на окончание (nebesá)
    validateWordParadigm('nebo', 'neuter');
}

runValidationSuite();
