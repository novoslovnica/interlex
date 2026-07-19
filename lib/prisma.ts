// lib/prisma.ts
import { PrismaClient as AuthClient } from "../prisma/generated/auth/client";
import { PrismaClient as DataClient } from "../prisma/generated/data/client";
import { PrismaClient as LibraryClient } from "../prisma/generated/library/client";
import { PrismaClient as CorpusClient } from "../prisma/generated/corpus/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Глобальные типы для предотвращения создания лишних подключений при Hot Reload
const globalForPrisma = globalThis as unknown as {
    prismaAuth: AuthClient | undefined;
    prismaData: DataClient | undefined;
    prismaLibrary: LibraryClient | undefined;
    prismaCorpus: CorpusClient | undefined;
};

// 1. Инициализируем базу данных авторизации (auth.db)
const authAdapter = new PrismaBetterSqlite3({
    url: process.env.AUTH_DATABASE_URL ?? "file:./prisma/auth.db",
});
export const prismaAuth = globalForPrisma.prismaAuth || new AuthClient({ adapter: authAdapter });

// 2. Инициализируем основную базу данных приложения (app.db)
const dataAdapter = new PrismaBetterSqlite3({
    url: process.env.DATA_DATABASE_URL ?? "file:./prisma/interlex.db",
});
export const prismaData = globalForPrisma.prismaData || new DataClient({ adapter: dataAdapter });

// 3. Инициализируем базу данных библиотеки (library.db)
const libraryAdapter = new PrismaBetterSqlite3({
    url: process.env.LIBRARY_DATABASE_URL ?? "file:./prisma/library.db",
});
export const prismaLibrary = globalForPrisma.prismaLibrary || new LibraryClient({ adapter: libraryAdapter });

// 4. Инициализируем базу данных корпуса (corpus.db)
const corpusAdapter = new PrismaBetterSqlite3({
    url: process.env.CORPUS_DATABASE_URL ?? "file:./prisma/corpus.db",
});
export const prismaCorpus = globalForPrisma.prismaCorpus || new CorpusClient({ adapter: corpusAdapter });

// Сохраняем инстансы в глобальный объект в режиме разработки
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaAuth = prismaAuth;
    globalForPrisma.prismaData = prismaData;
    globalForPrisma.prismaLibrary = prismaLibrary;
    globalForPrisma.prismaCorpus = prismaCorpus;
}
