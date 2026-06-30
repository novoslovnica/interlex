import * as fs from 'fs';
import * as path from 'path';
import {prismaData as prisma} from "@/lib/prisma";
import {init} from "@/lib/sqlite";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

interface EnhancedJsonItem {
    interslavic: string;    // Междуславянская лемма из JSON (ryba, syn, svět)
    protoSlavic: string;    // Чистый праславянский оригинал (ryba, synъ, světъ)
    paradigm: 'A' | 'B' | 'C';
    gender: 'masculine' | 'feminine' | 'neuter' | 'verb';
    protoStemClass: string;
    stemExtension?: string;
}

/**
 * Мягкая лингвистическая очистка строк для сопоставления лемм
 */
function superCleanMatch(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/[\u0301\u0300\u0302\u0311\u0304\u0306\u030b\u0307]/g, '') // Убираем Unicode-ударения
        .replace(/[^a-zA-Zěęǫųščžy]/g, ''); // Оставляем только чистые буквы
}

/**
 * Конвертер тега рода из словаря Дерксена в стандартный тег части речи (POS)
 */
function mapGenderToPos(gender: string): string {
    if (gender === 'verb') return 'verb';
    return 'noun'; // masculine, feminine, neuter — это всё существительные
}

async function enrichAndSeedDatabase() {
    const jsonPath = path.resolve('./drafts/derksen_accents_enhanced.json');

    if (!fs.existsSync(jsonPath)) {
        console.error(`Ошибка: База данных ${jsonPath} не найдена. Сначала скомпилируйте JSON!`);
        return;
    }

    const jsonDb: EnhancedJsonItem[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`Запуск конвейера Upsert. Найдено лемм в JSON: ${jsonDb.length}. Синхронизация с СУБД...`);

    let updatedCount = 0;
    let createdCount = 0;

    const db = await init();

    for (const jsonItem of jsonDb) {
        const cleanIsv = superCleanMatch(jsonItem.interslavic);
        if (!cleanIsv) continue;

        // 1. Пытаемся найти существующую лемму в таблице 'words'
        // const existingWord = await prisma.word.findFirst({
        //     where: {
        //         OR: [
        //             { value: { contains: cleanIsv } },
        //             { isv: { contains: cleanIsv } }
        //         ]
        //     }
        // });
        const existingWord = db.prepare(`
          SELECT * FROM words 
          WHERE "value" LIKE ? OR "isv" LIKE ? 
          LIMIT 1
        `).get(cleanIsv, cleanIsv);

        // Проверяем строгое совпадение очищенных строк (защита от ложных contains на коротких подстроках)
        const isMatched = existingWord && superCleanMatch(existingWord.value || existingWord.isv || '') === cleanIsv;

        if (isMatched && existingWord) {
            // КЕЙС 1: Слово СУЩЕСТВУЕТ ➔ Обогащаем метаданными
            // await prisma.word.update({
            //     where: { id: existingWord.id },
            //     data: {
            //         proto: jsonItem.protoSlavic,
            //         paradigm: jsonItem.paradigm,
            //         protoStemClass: jsonItem.protoStemClass,
            //         stemExtension: jsonItem.stemExtension || null,
            //         etymology: existingWord.etymology || `Proto-Slavic: *${jsonItem.protoSlavic}`
            //     }
            // });

        const updateWord = db.prepare(`
          UPDATE words
          SET 
            "proto" = :proto,
            "paradigm" = :paradigm,
            "protoStemClass" = :protoStemClass,
            "stemExtension" = :stemExtension,
            "etymology" = :etymology
          WHERE "id" = :id
        `);

    const result = updateWord.run({
        id: existingWord.id,
        proto: jsonItem.protoSlavic,
        paradigm: jsonItem.paradigm,
        protoStemClass: jsonItem.protoStemClass,
        stemExtension: jsonItem.stemExtension || null, // SQLite корректно запишет null
        etymology: existingWord.etymology || `Proto-Slavic: *${jsonItem.protoSlavic}`
    });

            updatedCount++;
        } else {
            // КЕЙС 2: Слово НЕ НАЙДЕНО ➔ Создаем новую полноценную лемму!
            // await prisma.word.create({
            //     data: {
            //         value: jsonItem.interslavic,           // Записываем чистую междуславянскую лемму
            //         isv: jsonItem.interslavic,             // Дублируем в поле isv для совместимости ваших индексов
            //         proto: jsonItem.protoSlavic,           // Праславянская форма (*synъ)
            //         paradigm: jsonItem.paradigm,           // Парадигма по Зализняку (A, B, C)
            //         protoStemClass: jsonItem.protoStemClass, // Класс праславянской основы (ā, jo, u, consonant)
            //         stemExtension: jsonItem.stemExtension || null,
            //         pos: mapGenderToPos(jsonItem.gender),  // Автоматически выставляем часть речи (noun или verb)
            //         type: jsonItem.gender,                 // Сохраняем исходный тег рода/категории
            //         etymology: `Proto-Slavic: *${jsonItem.protoSlavic}. Discovered via Rick Derksen's Inherited Slavic Lexicon.`
            //     }
            // });
            const etymologyValue = `Proto-Slavic: *${jsonItem.protoSlavic}. Discovered via Rick Derksen's Inherited Slavic Lexicon.`;
            const posValue = mapGenderToPos(jsonItem.gender);

            // 2. Подготавливаем SQL-запрос для вставки записи
            const insertWord = db.prepare(`
              INSERT INTO words (
                "value", 
                "isv", 
                "proto", 
                "paradigm", 
                "protoStemClass", 
                "stemExtension", 
                "pos", 
                "type", 
                "etymology"
              ) VALUES (
                :value, 
                :isv, 
                :proto, 
                :paradigm, 
                :protoStemClass, 
                :stemExtension, 
                :pos, 
                :type, 
                :etymology
              )
            `);

            // 3. Выполняем запрос, передавая объект с данными
            insertWord.run({
                value: jsonItem.interslavic,
                isv: jsonItem.interslavic,
                proto: jsonItem.protoSlavic,
                paradigm: jsonItem.paradigm,
                protoStemClass: jsonItem.protoStemClass,
                stemExtension: jsonItem.stemExtension || null, // SQLite запишет как NULL
                pos: posValue,
                type: jsonItem.gender,
                etymology: etymologyValue
            });


            createdCount++;
        }
    }

    console.log('\n==================================================');
    console.log('СИНХРОНИЗАЦИЯ И СИДДИНГ БАЗЫ ДАННЫХ ЗАВЕРШЕНЫ');
    console.log(`Существующих лемм в БД обогащено: ${updatedCount}`);
    // Эта цифра покажет, сколько крутых новых слов влилось в ваше приложение!
    console.log(`Новых уникальных лемм импортировано в БД: ${createdCount}`);
    console.log('==================================================');
}

enrichAndSeedDatabase()
    .catch((e) => console.error('Критическая ошибка конвейера СУБД:', e))
    .finally(() => prisma.$disconnect());
