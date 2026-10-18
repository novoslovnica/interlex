// prisma.config.ts
import "dotenv/config";
import path from "path";
import { defineConfig } from "@prisma/config";
import {resolveDatabaseUrls} from "./lib/databaseUrls";

function resolveFileUrl(rawUrl: string): string {
    const match = rawUrl.match(/^file:(.+)$/);
    if (match) {
        return "file:" + path.resolve(process.cwd(), match[1]);
    }
    return rawUrl;
}

const databaseUrls = resolveDatabaseUrls();
const dbType = process.env.DB_TYPE;

// 1. Создаем переменную для конфигурации
let config;

if (dbType === "auth") {
    config = defineConfig({
        schema: "prisma/auth.schema.prisma",
        migrations: { path: "prisma/migrations/auth" },
        datasource: { url: resolveFileUrl(databaseUrls.auth) },
    });
} else if (dbType === "library") {
    config = defineConfig({
        schema: "prisma/library.schema.prisma",
        migrations: { path: "prisma/migrations/library" },
        datasource: { url: resolveFileUrl(databaseUrls.library) },
    });
} else if (dbType === "corpus") {
    config = defineConfig({
        schema: "prisma/corpus.schema.prisma",
        migrations: { path: "prisma/migrations/corpus" },
        datasource: { url: resolveFileUrl(databaseUrls.corpus) },
    });
} else if (dbType === "historical") {
    config = defineConfig({
        schema: "prisma/historical.schema.prisma",
        migrations: { path: "prisma/migrations/historical" },
        datasource: { url: resolveFileUrl(databaseUrls.historical) },
    });
} else {
    config = defineConfig({
        schema: "prisma/data.schema.prisma",
        migrations: { path: "prisma/migrations/data" },
        datasource: { url: resolveFileUrl(databaseUrls.data) },
    });
}

// 2. Экспортируем её один раз в самом конце файла
export default config;
