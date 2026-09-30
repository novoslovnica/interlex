// Standalone Telegram-бот-сервис (без Next) — живёт на отдельном сервере,
// где Telegram виден (доступен inbound с его IP-диапазонов), а основной сайт
// остаётся на своём сервере. Та же логика, что была у webhook-роута:
// Telegram Update -> handleTelegramUpdate -> ответ конвенцией прямого ответа
// ({method: "sendMessage", ...}), дополнительный вызов Bot API не нужен.
//
// Запуск:
//   разработка:        npm run bot:start
//   прод (бандл):      node dist/server.mjs          # см. scripts/ops/bundle-telegram-bot.ts
//
// Env (бандл грузит .env/.env.production из своего cwd через dotenv):
//   TELEGRAM_WEBHOOK_SECRET — обязателен, верификация входящих апдейтов
//   DATA_DATABASE_URL       — file:<путь>/interlex.db (снапшот для prismaData)
//   SQLITE_DB               — тот же снапшот для сырых запросов (lib/sqlite)
//   BOT_PORT                — порт (default 8787), слушаем 0.0.0.0; снаружи
//                             закрывайте фаерволом, наружу выставлять через nginx с TLS
//   TELEGRAM_BOT_NAME       — опционально, для подсказки в help
// Токен боту НЕ нужен: отвечаем прямым HTTP-ответом, Bot API не дёргаем.

import http from "node:http"
import crypto from "node:crypto"
import dotenv from "dotenv"
import { handleTelegramUpdate } from "@/lib/bots/telegram/handle"
import { getAnalyzerIfReady } from "@/lib/bots/core/analyzer"
import { waitForAnalyzer } from "@/lib/bots/core/analyzer"
import type { TelegramUpdate } from "@/lib/bots/telegram/update"

dotenv.config({ path: ".env.production", quiet: true })
dotenv.config({ path: ".env", quiet: true })

const PORT = Number(process.env.BOT_PORT ?? 8787)
const secretEnv = process.env.TELEGRAM_WEBHOOK_SECRET

if (!secretEnv) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not set — refusing to start without forgery protection.")
    process.exit(1)
}
const SECRET: string = secretEnv

function verifySecret(header: string | null): boolean {
    if (!header) return false
    const a = Buffer.from(header)
    const b = Buffer.from(SECRET)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && (req.url === "/healthz" || req.url === "/healthz/")) {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ ok: true, analyzerReady: getAnalyzerIfReady() !== null }))
        return
    }

    if (req.method !== "POST") {
        res.writeHead(404).end("{}")
        return
    }

    if (!verifySecret(req.headers["x-telegram-bot-api-secret-token"] as string | null)) {
        res.writeHead(403, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Forbidden" }))
        return
    }

    let update: TelegramUpdate
    try {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        update = JSON.parse(Buffer.concat(chunks).toString("utf8")) as TelegramUpdate
    } catch {
        // Telegram ретраит не-2xx — плохой JSON отвечаем пустым 200, не ошибкой.
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end("{}")
        return
    }

    const reply = await handleTelegramUpdate(update)
    res.writeHead(200, { "Content-Type": "application/json" })
    // Конвенция прямого ответа: Telegram исполняет {method, ...} как вызов Bot API.
    res.end(reply ? JSON.stringify({ method: "sendMessage", chat_id: reply.chatId, text: reply.html, parse_mode: "HTML" }) : "{}")
})

// Прогрев форм-анализатора сразу при старте (~20 с), чтобы первый запрос
// пользователя не ждал построения индекса.
getAnalyzerIfReady()
waitForAnalyzer()
    .then(() => console.log("[bot] form analyzer ready"))
    .catch((err) => console.error("[bot] form analyzer build failed (dictionary-only mode):", err))

server.listen(PORT, () => {
    console.log(`[bot] telegram bot service listening on :${PORT} (healthz: GET /healthz)`)
})

const shutdown = () => {
    console.log("[bot] shutting down…")
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 3000).unref()
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
