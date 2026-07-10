import * as fs from 'fs';
import * as path from 'path';
import {prismaData as prisma} from "@/lib/prisma";
import {generateStemCandidates, heuristicStem} from "@/lib/grammar/common";
import {init} from "@/lib/sqlite";
import {generateAllFlavors} from "@/lib/flavors";
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
        // const existingWord = await prisma.lexeme.findFirst({
        //     where: {
        //         OR: [
        //             { value: { contains: cleanIsv } },
        //             { isv: { contains: cleanIsv } }
        //         ]
        //     }
        // });
        const existingWord = db.prepare(`
          SELECT * FROM lexemes 
          WHERE "value" LIKE ? 
          LIMIT 1
        `).get(cleanIsv);

        // Проверяем строгое совпадение очищенных строк (защита от ложных contains на коротких подстроках)
        const isMatched = existingWord && superCleanMatch(existingWord.value || '') === cleanIsv;

        if (isMatched && existingWord) {
            // КЕЙС 1: Слово СУЩЕСТВУЕТ ➔ Обогащаем метаданными
            // await prisma.lexeme.update({
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
          UPDATE lexemes
          SET 
            proto = ?,
            paradigm = ?,
            protoStemClass = ?,
            stemExtension = ?,
            etymology = ?
          WHERE id = ?
        `);

            const result = updateWord.run(
                jsonItem.protoSlavic,
                jsonItem.paradigm,
                jsonItem.protoStemClass,
                jsonItem.stemExtension || null, // SQLite корректно запишет null
                existingWord.etymology || `Proto-Slavic: *${jsonItem.protoSlavic}`,
                existingWord.id,
            );

            updatedCount++;
        } else {
            // КЕЙС 2: Слово НЕ НАЙДЕНО ➔ Создаем новую полноценную лемму!
            // await prisma.lexeme.create({
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

            const check = db.prepare(`SELECT * FROM lexemes WHERE slug = ? `).get(`${jsonItem.interslavic}-${posValue}`);

            if (!check) {

                // 2. Подготавливаем SQL-запрос для вставки записи
                const insertWord = db.prepare(`
INSERT INTO lexemes ("value",
                                       "proto",
                                       "paradigm",
                                       "protoStemClass",
                                       "stemExtension",
                                       "pos",
                                       "gender",
                                       "etymology",
                                       "slug",
                                       "updatedAt")
                     VALUES (:value,
                             :proto,
                             :paradigm,
                             :protoStemClass,
                             :stemExtension,
                             :pos,
                             :gender,
                             :etymology,
                             :slug,
                             :updatedAt)
                `);

// 3. Выполняем запрос, передавая объект с данными
                const result = insertWord.run({
                    value: jsonItem.interslavic,
                    proto: jsonItem.protoSlavic,
                    paradigm: jsonItem.paradigm,
                    protoStemClass: jsonItem.protoStemClass,
                    stemExtension: jsonItem.stemExtension || null,
                    pos: posValue,
                    gender: jsonItem.gender,
                    etymology: etymologyValue,
                    slug: `${jsonItem.interslavic}-${posValue}`,
                    updatedAt: new Date().toISOString(),
                });

                db.prepare(`INSERT INTO lexeme_allophones (lexemeId, value, flavorId, type) VALUES (?, ?, (SELECT id FROM allophone_flavors WHERE code = 'CORE'), 'standard') ON CONFLICT(lexemeId, flavorId, type) DO UPDATE SET value = excluded.value`)
                    .run(result.lastInsertRowid, jsonItem.interslavic.toLowerCase());
                db.prepare(`INSERT INTO lexeme_allophones (lexemeId, value, flavorId, type) VALUES (?, ?, (SELECT id FROM allophone_flavors WHERE code = 'NSL'), 'standard') ON CONFLICT(lexemeId, flavorId, type) DO UPDATE SET value = excluded.value`)
                    .run(result.lastInsertRowid, '');

                const flavors = generateAllFlavors(jsonItem.interslavic);
                for (const [code, val] of [["EAST", flavors.east], ["WEST", flavors.west], ["SOUTH", flavors.south]] as const) {
                    db.prepare(`INSERT INTO lexeme_allophones (lexemeId, value, flavorId, type) VALUES (?, ?, (SELECT id FROM allophone_flavors WHERE code = ?), 'standard') ON CONFLICT(lexemeId, flavorId, type) DO UPDATE SET value = excluded.value`)
                        .run(result.lastInsertRowid, val.toLowerCase(), code);
                }

                const stem = heuristicStem(jsonItem.interslavic, posValue).toLowerCase();
                if (stem) {
                    const candidates = generateStemCandidates({
                        stem,
                        secondaryStem: "",
                        tertiaryStem: "",
                        isv: jsonItem.interslavic,
                        pos: posValue,
                    });
                    const lexemeIdNum = Number(result.lastInsertRowid);
                    const upsertHomonym = (base: string) => {
                        const existing = db.prepare(`SELECT * FROM base_homonyms WHERE base = ?`).get(base) as { id: bigint; wordIds: string } | undefined;
                        if (existing) {
                            const ids: number[] = JSON.parse(existing.wordIds);
                            if (!ids.includes(lexemeIdNum)) {
                                ids.push(lexemeIdNum);
                                db.prepare(`UPDATE base_homonyms SET wordIds = ? WHERE id = ?`).run(JSON.stringify(ids), existing.id);
                            }
                        } else {
                            db.prepare(`INSERT INTO base_homonyms (base, wordIds) VALUES (?, ?)`).run(base, JSON.stringify([lexemeIdNum]));
                        }
                    };
                    for (const base of candidates) {
                        upsertHomonym(base);
                    }
                }
            } else {
                const updateWord = db.prepare(`
                  UPDATE lexemes
                  SET 
                    "proto" = :proto,
                    "paradigm" = :paradigm,
                    "protoStemClass" = :protoStemClass,
                    "stemExtension" = :stemExtension,
                    "etymology" = :etymology
                  WHERE "id" = :id
                `);

                const result = updateWord.run({
                    id: check.id,
                    proto: check.proto || jsonItem.protoSlavic,
                    paradigm: check.paradigm || jsonItem.paradigm,
                    protoStemClass: check.protoStemClass || jsonItem.protoStemClass,
                    stemExtension: check.stemExtension || jsonItem.stemExtension || null, // SQLite корректно запишет null
                    etymology: check.etymology || `Proto-Slavic: *${jsonItem.protoSlavic}`
                });
            }


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
