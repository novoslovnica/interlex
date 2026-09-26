// Long-polling фолбэк Telegram-бота на случай, когда webhook недоступен
// (провайдер/фаервол режет входящие соединения с IP-диапазонов Telegram).
// Та же логика обработки, что у webhook-роута (lib/bots/telegram/handle.ts),
// ответ доставляется вызовом sendMessage вместо прямого HTTP-ответа.
//
//   npx tsx scripts/ops/telegram-poll.ts            # бесконечный цикл
//   npx tsx scripts/ops/telegram-poll.ts --once     # один батч — для проверки
//   npx tsx scripts/ops/telegram-poll.ts --takeover # сначала deleteWebhook
//                                                     (webhook и getUpdates
//                                                     конфликтуют — 409)
//
// Запускать на сервере под systemd/supervisor/tmux — скрипт сам не демонизируется.
// Offset хранится в logs/telegram-poll-offset.txt (logs/ в gitignore), чтобы
// рестарт не переобрабатывал уже обработанные апдейты.

import fs from "fs"
import path from "path"
import dotenv from "dotenv"
import type { TelegramUpdate } from "@/lib/bots/telegram/update"

const ROOT = process.cwd()
dotenv.config({ path: path.join(ROOT, ".env.production"), quiet: true })
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true })

const OFFSET_FILE = path.join(ROOT, "logs", "telegram-poll-offset.txt")
const LONG_POLL_TIMEOUT_S = 50

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set")

const API = (method: string) => `https://api.telegram.org/bot${token}/${method}`

interface TgResponse<T> {
    ok: boolean
    result?: T
    error_code?: number
    description?: string
}

async function call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const res = await fetch(API(method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: params ? JSON.stringify(params) : undefined,
        signal: AbortSignal.timeout((LONG_POLL_TIMEOUT_S + 15) * 1000),
    })
    const data = (await res.json()) as TgResponse<T>
    if (!data.ok) {
        const err = new Error(`${method} failed (${data.error_code}): ${data.description ?? res.status}`) as Error & { errorCode?: number }
        err.errorCode = data.error_code
        throw err
    }
    return data.result as T
}

interface Update extends TelegramUpdate {
    update_id: number
}

function readOffset(): number | undefined {
    try {
        const raw = fs.readFileSync(OFFSET_FILE, "utf8").trim()
        const n = Number(raw)
        return Number.isInteger(n) && n > 0 ? n : undefined
    } catch {
        return undefined
    }
}

function writeOffset(offset: number): void {
    fs.mkdirSync(path.dirname(OFFSET_FILE), { recursive: true })
    const tmp = `${OFFSET_FILE}.tmp`
    fs.writeFileSync(tmp, String(offset))
    fs.renameSync(tmp, OFFSET_FILE)
}

async function processUpdates(updates: Update[]): Promise<number | undefined> {
    const { handleTelegramUpdate } = await import("@/lib/bots/telegram/handle")
    let lastOffset: number | undefined
    for (const update of updates) {
        lastOffset = update.update_id + 1
        const reply = await handleTelegramUpdate(update)
        if (reply) {
            await call("sendMessage", { chat_id: reply.chatId, text: reply.html, parse_mode: "HTML" })
            const preview = reply.html.split("\n")[0]?.slice(0, 60) ?? ""
            console.log(`[poll] reply → chat ${reply.chatId}: ${preview}`)
        }
        writeOffset(update.update_id + 1)
    }
    return lastOffset
}

async function main(): Promise<void> {
    const once = process.argv.includes("--once")
    const takeover = process.argv.includes("--takeover")

    const me = await call<{ username?: string; first_name?: string }>("getMe")
    console.log(`Bot: @${me.username ?? "?"} (${me.first_name ?? ""})`)

    const info = await call<{ url?: string }>("getWebhookInfo")
    if (info.url) {
        if (!takeover) {
            console.error(`Webhook is active (${info.url}) — getUpdates will conflict (409).`)
            console.error("Re-run with --takeover to deleteWebhook first, or use the webhook mode.")
            process.exit(1)
        }
        await call("deleteWebhook")
        console.log("Webhook deleted (--takeover).")
    }

    let offset = readOffset()
    console.log(`Polling (timeout ${LONG_POLL_TIMEOUT_S}s, offset ${offset ?? "fresh"})${once ? ", --once" : ""}…`)

    let running = !once
    const stop = () => { running = false }
    process.on("SIGINT", stop)
    process.on("SIGTERM", stop)

    do {
        try {
            const updates = await call<Update[]>("getUpdates", {
                ...(offset !== undefined ? { offset } : {}),
                timeout: LONG_POLL_TIMEOUT_S,
                allowed_updates: ["message"],
            })
            const last = await processUpdates(updates)
            if (last !== undefined) offset = last
        } catch (err) {
            const code = (err as { errorCode?: number }).errorCode
            if (code === 409) {
                console.error("409 Conflict: another getUpdates loop or webhook is active. Stopping.")
                process.exit(1)
            }
            console.error(`[poll] getUpdates error: ${err instanceof Error ? err.message : err}; retrying in 5s`)
            await new Promise((r) => setTimeout(r, 5000))
        }
    } while (running)

    console.log("Done.")
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
})
