// Webhook Telegram-бота. Telegram шлёт сюда каждый апдейт; ответ в формате
// {method: "sendMessage", ...} Telegram исполняет как вызов Bot API, так что
// отвечать пользователю можно прямым HTTP-ответом без второго запроса.
// Регистрация webhook'а: scripts/ops/telegram-set-webhook.ts.

import crypto from "crypto"
import { NextResponse } from "next/server"
import { runCommand } from "@/lib/bots/core/commands"
import { toTelegramHtml } from "@/lib/bots/core/message"
import { telegramUpdateToCommand, type TelegramUpdate } from "@/lib/bots/telegram/update"

let warnedMissingSecret = false

// Верификация secret_token'а, заданного в setWebhook. На проде
// TELEGRAM_WEBHOOK_SECRET обязателен — без него любой, знающий URL роута,
// может отправлять боту поддельные апдейты.
function verifySecretToken(header: string | null): boolean {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!expected) {
        if (!warnedMissingSecret) {
            warnedMissingSecret = true
            console.warn("[bots/telegram] TELEGRAM_WEBHOOK_SECRET is not set - webhook requests are unverified. Set it in production!")
        }
        return true
    }
    if (!header) return false
    const a = Buffer.from(header)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function sendMessage(chatId: number, text: string) {
    return NextResponse.json({ method: "sendMessage", chat_id: chatId, text, parse_mode: "HTML" })
}

// Telegram ретраит апдейт, если webhook ответил не 2xx — неподходящие апдейты
// (стикеры и пр.) отвечаем пустым объектом, а не ошибкой.
const OK_EMPTY = () => NextResponse.json({})

export async function POST(req: Request) {
    if (!verifySecretToken(req.headers.get("x-telegram-bot-api-secret-token"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let update: TelegramUpdate
    try {
        update = (await req.json()) as TelegramUpdate
    } catch {
        return OK_EMPTY()
    }

    const parsed = telegramUpdateToCommand(update)
    if (!parsed) return OK_EMPTY()

    try {
        const msg = await runCommand(parsed.cmd, {
            languageCode: parsed.languageCode,
            botName: process.env.TELEGRAM_BOT_NAME,
        })
        return sendMessage(parsed.chatId, toTelegramHtml(msg))
    } catch (err) {
        console.error("[bots/telegram] runCommand failed:", err)
        return sendMessage(parsed.chatId, "⚠️ Something went wrong, please try again later.")
    }
}
