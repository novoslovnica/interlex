// Обработка одного Telegram Update → готовый HTML-ответ для чата.
// Общая логика webhook-роута (app/api/bots/telegram/route.ts) и поллера
// (scripts/ops/telegram-poll.ts) — оба только по-разному доставляют ответ
// (прямой HTTP-ответ vs вызов sendMessage).

import { runCommand } from "@/lib/bots/core/commands"
import { toTelegramHtml } from "@/lib/bots/core/message"
import { telegramUpdateToCommand, type TelegramUpdate } from "./update"

export interface BotReply {
    chatId: number
    html: string
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<BotReply | null> {
    const parsed = telegramUpdateToCommand(update)
    if (!parsed) return null
    try {
        const msg = await runCommand(parsed.cmd, {
            languageCode: parsed.languageCode,
            botName: process.env.TELEGRAM_BOT_NAME,
        })
        return { chatId: parsed.chatId, html: toTelegramHtml(msg) }
    } catch (err) {
        console.error("[bots/telegram] runCommand failed:", err)
        return { chatId: parsed.chatId, html: "⚠️ Something went wrong, please try again later." }
    }
}
