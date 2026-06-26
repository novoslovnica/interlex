// lib/prisma.ts
import { PrismaClient as AuthClient } from "../prisma/generated/auth/client";
import { PrismaClient as DataClient } from "../prisma/generated/data/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Глобальные типы для предотвращения создания лишних подключений при Hot Reload
const globalForPrisma = globalThis as unknown as {
    prismaAuth: AuthClient | undefined;
    prismaData: DataClient | undefined;
};

// 1. Инициализируем базу данных авторизации (auth.db)
const authAdapter = new PrismaBetterSqlite3({
    url: process.env.AUTH_DATABASE_URL ?? "file:./prisma/auth.db",
});
export const prismaAuth = globalForPrisma.prismaAuth || new AuthClient({ adapter: authAdapter });

// 2. Инициализируем основную базу данных приложения (app.db)
const dataAdapter = new PrismaBetterSqlite3({
    url: process.env.DATA_DATABASE_URL ?? "file:./prisma/app.db",
});
export const prismaData = globalForPrisma.prismaData || new DataClient({ adapter: dataAdapter });

// Сохраняем инстансы в глобальный объект в режиме разработки
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaAuth = prismaAuth;
    globalForPrisma.prismaData = prismaData;
}
