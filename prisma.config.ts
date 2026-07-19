// prisma.config.ts
import "dotenv/config";
import path from "path";
import { defineConfig, env } from "@prisma/config";

function resolveFileUrl(rawUrl: string): string {
    const match = rawUrl.match(/^file:(.+)$/);
    if (match) {
        return "file:" + path.resolve(process.cwd(), match[1]);
    }
    return rawUrl;
}

const dbType = process.env.DB_TYPE;

// 1. Создаем переменную для конфигурации
let config;

if (dbType === "auth") {
    config = defineConfig({
        schema: "prisma/auth.schema.prisma",
        migrations: { path: "prisma/migrations/auth" },
        datasource: { url: resolveFileUrl(env("AUTH_DATABASE_URL") ?? "file:./auth.db") },
    });
} else if (dbType === "library") {
    config = defineConfig({
        schema: "prisma/library.schema.prisma",
        migrations: { path: "prisma/migrations/library" },
        datasource: { url: resolveFileUrl(env("LIBRARY_DATABASE_URL") ?? "file:./library.db") },
    });
} else if (dbType === "corpus") {
    config = defineConfig({
        schema: "prisma/corpus.schema.prisma",
        migrations: { path: "prisma/migrations/corpus" },
        datasource: { url: resolveFileUrl(env("CORPUS_DATABASE_URL") ?? "file:./corpus.db") },
    });
} else {
    config = defineConfig({
        schema: "prisma/data.schema.prisma",
        migrations: { path: "prisma/migrations/data" },
        datasource: { url: resolveFileUrl(env("DATA_DATABASE_URL") ?? "file:./app.db") },
    });
}

// 2. Экспортируем её один раз в самом конце файла
export default config;
