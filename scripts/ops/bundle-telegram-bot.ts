// Сборка standalone-бандла Telegram-бот-сервиса для выкладки на сервер 2
// (где Telegram виден). Бандлит только код проекта; внешние зависимости
// (better-sqlite3, @prisma/*) остаются внешними и доустанавливаются на
// сервере через dist/package.json (нативный better-sqlite3 обязан собраться
// под целевую машину, а не копироваться).
//
//   npm run bot:bundle   # -> services/telegram-bot/dist/{server.mjs, package.json}

import fs from "node:fs"
import path from "node:path"
import * as esbuild from "esbuild"

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, "services", "telegram-bot", "dist")

// Ровно те пакеты, которые реально нужны runtime-графу бота (проверено
// обходом импортов lib/bots + lib/grammar + lib/corpus/tokenizer): нативный
// better-sqlite3 и Prisma-рантайм (клиент генерированного кода + адаптер).
// Всё остальное — код проекта, уходит внутрь бандла.
const EXTERNAL_DEPS = ["better-sqlite3", "@prisma/client", "@prisma/adapter-better-sqlite3"]

async function main() {
    await esbuild.build({
        entryPoints: [path.join(ROOT, "services", "telegram-bot", "server.ts")],
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node20",
        outfile: path.join(OUT_DIR, "server.mjs"),
        external: EXTERNAL_DEPS,
        // ESM-бандл с захваченными CJS-зависимостями (dotenv и др.) — без
        // createRequire их динамические require("fs") падают в runtime.
        banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
        logLevel: "info",
    })

    fs.mkdirSync(OUT_DIR, { recursive: true })
    const rootPkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
        dependencies: Record<string, string>
    }
    const deps: Record<string, string> = {}
    for (const name of EXTERNAL_DEPS) {
        const version = rootPkg.dependencies[name]
        if (!version) throw new Error(`${name} is not in root package.json dependencies`)
        deps[name] = version
    }
    fs.writeFileSync(
        path.join(OUT_DIR, "package.json"),
        JSON.stringify({ name: "interlex-telegram-bot", private: true, type: "module", dependencies: deps }, null, 2) + "\n",
    )

    console.log(`\nBundle written to ${path.join(OUT_DIR, "server.mjs")}`)
    console.log(`Deploy: scp -r ${OUT_DIR} <server2>:/opt/interlex-telegram-bot && ssh <server2> 'cd /opt/interlex-telegram-bot && npm i --omit=dev'`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
