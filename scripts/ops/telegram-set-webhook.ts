// Регистрация webhook'а Telegram-бота: getMe → setWebhook → getWebhookInfo.
// Idempotent — повторный setWebhook с тем же url/secret просто перезаписывает.
//
//   npx tsx scripts/ops/telegram-set-webhook.ts                          # setWebhook
//   npx tsx scripts/ops/telegram-set-webhook.ts --origin https://bot.example.com
//   npx tsx scripts/ops/telegram-set-webhook.ts --drop                   # и drop_pending_updates
//
// Origin webhook'а — сервер, где крутится standalone-сервис бота
// (services/telegram-bot), т.е. машина, ВИДИМАЯ для Telegram. Это НЕ обязательно
// сервер основного сайта (он может блокировать входящие с IP Telegram).
//
// Env: сначала подхватываются .env.production и .env из корня проекта (tsx
// сам .env НЕ грузит — известный готча, см. docs/history/2026-07-29-corpus-candidate-proposals.md),
// реальные переменные окружения имеют приоритет над файлами.
//   TELEGRAM_BOT_TOKEN       — обязателен
//   BOT_ORIGIN | NEXTAUTH_URL | SITE_URL — origin webhook URL
//   TELEGRAM_WEBHOOK_SECRET  — обязателен, ставится в setWebhook как secret_token
//                              и проверяется сервисом (services/telegram-bot/server.ts)

import path from "path"
import dotenv from "dotenv"

const ROOT = process.cwd()
dotenv.config({ path: path.join(ROOT, ".env.production"), quiet: true })
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true })

const API = (method: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`

async function call(method: string, params?: Record<string, unknown>) {
    const res = await fetch(API(method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: params ? JSON.stringify(params) : undefined,
    })
    const data = (await res.json()) as { ok: boolean; result?: unknown; description?: string }
    if (!data.ok) throw new Error(`${method} failed: ${data.description ?? res.status}`)
    return data.result
}

async function main() {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set")
    const originFlag = process.argv.indexOf("--origin")
    const origin = originFlag >= 0
        ? process.argv[originFlag + 1]
        : process.env.BOT_ORIGIN ?? process.env.NEXTAUTH_URL ?? process.env.SITE_URL
    if (!origin) throw new Error("webhook origin is not set: pass --origin <url>, or set BOT_ORIGIN / NEXTAUTH_URL / SITE_URL")
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!secret) throw new Error("TELEGRAM_WEBHOOK_SECRET is not set (the service refuses to start without it, and forgery protection is gone)")

    const me = (await call("getMe")) as { username?: string; first_name?: string }
    console.log(`Bot: @${me.username ?? "?"} (${me.first_name ?? ""})`)

    const url = `${origin.replace(/\/$/, "")}/`
    await call("setWebhook", {
        url,
        secret_token: secret,
        allowed_updates: ["message"],
        ...(process.argv.includes("--drop") ? { drop_pending_updates: true } : {}),
    })
    console.log(`Webhook set: ${url}`)

    const info = (await call("getWebhookInfo")) as { url?: string; pending_update_count?: number; last_error_message?: string | null }
    console.log("getWebhookInfo:", JSON.stringify(info, null, 2))
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
})
