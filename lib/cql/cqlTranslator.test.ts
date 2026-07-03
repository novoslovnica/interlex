import { CqlParser } from './cqlParser';
import { CqlTranslator } from './cqlTranslator';
import Database from 'better-sqlite3'; // Если работаем напрямую с SQLite воркером
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = new Database('analytics.db');

async function executeCqlSearch(cqlInput: string) {
    // 1. Парсим строку в AST
    const ast = CqlParser.parse(cqlInput);

    // 2. Транслируем AST в чистый параметризованный SQL
    const { query, params } = CqlTranslator.toSQL(ast);

    console.log('Сгенерированный SQL:', query);
    console.log('Параметры:', params);

    // Вариант А: Выполнение через better-sqlite3 (напрямую в файле БД)
    const stmt = db.prepare(query);
    const resultsFromSqlite = stmt.all(...params);

    // Вариант Б: Выполнение через Prisma Raw SQL ($queryRawUnsafe)
    // Используем Unsafe, так как сама строка запроса динамическая,
    // но параметры передаем отдельно, что полностью исключает SQL-инъекции.
    const resultsFromPrisma = await prisma.$queryRawUnsafe(query, ...params);

    return resultsFromPrisma;
}

// Запуск теста
executeCqlSearch('[pos="ADJ"] [lemma="dom"]')
    .then(res => console.log('Найденные совпадения корпусных интервалов:', res))
    .catch(err => console.error(err));
