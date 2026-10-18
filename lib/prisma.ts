// lib/prisma.ts
import {resolveDatabaseUrls} from "./databaseUrls"
import { PrismaClient as AuthClient } from "../prisma/generated/auth/client";
import { PrismaClient as DataClient } from "../prisma/generated/data/client";
import { PrismaClient as LibraryClient } from "../prisma/generated/library/client";
import { PrismaClient as CorpusClient } from "../prisma/generated/corpus/client";
import { PrismaClient as HistoricalClient } from "../prisma/generated/historical/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Глобальные типы для предотвращения создания лишних подключений при Hot Reload
const globalForPrisma = globalThis as unknown as {
    prismaAuth: AuthClient | undefined;
    prismaData: DataClient | undefined;
    prismaLibrary: LibraryClient | undefined;
    prismaCorpus: CorpusClient | undefined;
    prismaHistorical: HistoricalClient | undefined;
};

const databaseUrls = resolveDatabaseUrls();

// 1. Инициализируем базу данных авторизации (auth.db)
const authAdapter = new PrismaBetterSqlite3({
    url: databaseUrls.auth,
});
export const prismaAuth = globalForPrisma.prismaAuth || new AuthClient({ adapter: authAdapter });

// 2. Инициализируем основную базу данных приложения (interlex.db)
const dataAdapter = new PrismaBetterSqlite3({
    url: databaseUrls.data,
});
export const prismaData = globalForPrisma.prismaData || new DataClient({ adapter: dataAdapter });

// 3. Инициализируем базу данных библиотеки (library.db)
const libraryAdapter = new PrismaBetterSqlite3({
    url: databaseUrls.library,
});
export const prismaLibrary = globalForPrisma.prismaLibrary || new LibraryClient({ adapter: libraryAdapter });

// 4. Инициализируем базу данных корпуса (corpus.db)
const corpusAdapter = new PrismaBetterSqlite3({
    url: databaseUrls.corpus,
});
export const prismaCorpus = globalForPrisma.prismaCorpus || new CorpusClient({ adapter: corpusAdapter });

// 5. Инициализируем базу данных исторических корпусов (historical.db)
const historicalAdapter = new PrismaBetterSqlite3({
    url: databaseUrls.historical,
});
export const prismaHistorical = globalForPrisma.prismaHistorical || new HistoricalClient({ adapter: historicalAdapter });

// Сохраняем инстансы в глобальный объект в режиме разработки
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaAuth = prismaAuth;
    globalForPrisma.prismaData = prismaData;
    globalForPrisma.prismaLibrary = prismaLibrary;
    globalForPrisma.prismaCorpus = prismaCorpus;
    globalForPrisma.prismaHistorical = prismaHistorical;
}
