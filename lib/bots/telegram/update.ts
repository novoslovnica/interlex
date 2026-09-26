// Разбор Telegram Update → BotCommand. Чистая функция: никакой сети и БД,
// роут (`app/api/bots/telegram/route.ts`) только зовёт runCommand на результате.

import type { BotCommand } from "@/lib/bots/core/commands"

/** Минимальная форма Telegram Update — только то, что разбирает бот. */
export interface TelegramUpdate {
    message?: {
        text?: string
        chat: { id: number }
        from?: {
            id?: number
            is_bot?: boolean
            language_code?: string
        }
    }
}

export interface ParsedUpdate {
    chatId: number
    cmd: BotCommand
    languageCode?: string
}

const COMMANDS = new Set(["start", "help", "forms", "cyr", "lat", "today"])

/**
 * Текст сообщения → команда ядра. `/start` и `/help` — help; пустой аргумент
 * у /forms, /cyr, /lat — help с подсказкой; остальной текст — поиск слова.
 * Команды могут приходить с суффиксом @имябота — отрезаем всё после "@".
 */
export function textToCommand(text: string): BotCommand {
    const trimmed = text.trim()
    if (!trimmed.startsWith("/")) return { kind: "lookup", query: trimmed }
    const body = trimmed.slice(1)
    const space = body.indexOf(" ")
    const head = space >= 0 ? body.slice(0, space) : body
    const arg = space >= 0 ? body.slice(space + 1).trim() : ""
    // Команды вида /forms@InterslavicBot — отрезаем @имябота.
    const at = head.indexOf("@")
    const name = (at >= 0 ? head.slice(0, at) : head).toLowerCase()
    if (name === "start" || name === "help" || !COMMANDS.has(name)) return { kind: "help" }
    if (name === "today") return { kind: "today" }
    if (!arg) return { kind: "help" }
    if (name === "forms") return { kind: "forms", query: arg }
    if (name === "cyr") return { kind: "cyr", text: arg }
    return { kind: "lat", text: arg }
}

export function telegramUpdateToCommand(update: TelegramUpdate): ParsedUpdate | null {
    const message = update.message
    if (!message?.text) return null
    if (message.from?.is_bot) return null
    return {
        chatId: message.chat.id,
        cmd: textToCommand(message.text),
        ...(message.from?.language_code ? { languageCode: message.from.language_code } : {}),
    }
}
