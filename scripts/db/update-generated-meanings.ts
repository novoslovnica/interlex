import * as fs from 'fs';
import * as path from 'path';

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

// Описываем строгий интерфейс для входного JSON без использования any
interface IncomingJsonWord {
    value: string;
    meaning: string;
    examples: string;
}

async function main(): Promise<void> {
    const { prismaData: prisma } = await import('@/lib/prisma')

    console.log('🚀 Запуск скрипта обновления значений и примеров...');

    // 1. Читаем и парсим JSON файл
    const jsonPath = path.join(process.cwd(), 'data', 'meanings.json');

    if (!fs.existsSync(jsonPath)) {
        console.error(`❌ Файл не найден по пути: ${jsonPath}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const wordsList: IncomingJsonWord[] = JSON.parse(rawData);

    let updatedCount = 0;
    let notFoundCount = 0;

    // 2. Итерируемся по списку слов
    for await (const item of wordsList) {
        // Ищем слово в таблице Word (или вашей таблице лексем, замените 'word' на точное имя модели)
        const dbWord = await prisma.word.findFirst({
            where: {
                isv: item.value,
            },
            include: {
                meanings: true, // Включаем связанные значения по wordId
            },
        });

        if (!dbWord) {
            console.warn(`⚠️ Слово "${item.value}" не найдено в таблице Word.`);
            notFoundCount++;
            continue;
        }

        // Проверяем, есть ли уже связанная запись в Meaning
        // Если в вашей схеме отношение @relation один-к-одному, meanings будет объектом, а не массивом
        const hasMeanings = Array.isArray(dbWord.meanings) ? dbWord.meanings.length > 0 : !!dbWord.meanings;

        if (hasMeanings) {
            for await (const m of dbWord.meanings) {
                await prisma.meaning.update({
                    where: {
                        id: m.id,
                    },
                    data: {
                        meaning: item.meaning,
                        examples: item.examples,
                    },
                });
            }
        } else {
            // Сценарий Б: У слова нет Meaning -> Создаем новую связанную запись по wordId
            await prisma.meaning.create({
                data: {
                    wordId: dbWord.id,
                    meaning: item.meaning,
                    examples: item.examples,
                },
            });
        }

        console.log(`✅ Успешно обновлено: "${item.value}"`);
        updatedCount++;
    }

    console.log('\n📊 Итоги миграции:');
    console.log(`- Всего обработано слов: ${wordsList.length}`);
    console.log(`- Успешно обновлено в БД: ${updatedCount}`);
    console.log(`- Не найдено в БД: ${notFoundCount}`);
}

main()
    .catch((e: Error) => {
        console.error('❌ Критическая ошибка при выполнении скрипта:', e.message);
        process.exit(1);
    })
