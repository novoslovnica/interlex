// Обработка одного Telegram Update → ответ для доставки платформой.
// Общая логика webhook-роута (когда он был в Next) и standalone-сервиса
// (services/telegram-bot) — оба только по-разному доставляют ответ
// (прямой HTTP-ответ vs вызов метода Bot API).

import { runCommand } from "@/lib/bots/core/commands"
import { toTelegramHtml } from "@/lib/bots/core/message"
import { lookupWord, loadEntryById } from "@/lib/bots/core/lookup"
import { getWordOfDayId } from "@/lib/bots/core/wordOfDay"
import { entryMessage, type Script } from "@/lib/bots/core/compose"
import { toBotLocale, translationLanguages, type BotLocale } from "@/lib/bots/core/labels"
import { TRANSLATION_LANGUAGES } from "@/config/features"
import { isCyrillicText } from "@/lib/orthography/standard"
import { telegramUpdateToCommand, telegramUpdateToInlineQuery, textToCommand, type TelegramUpdate } from "./update"
import { cachedInlineResults, messageToInlineResult, storeInlineResults, type InlineArticleResult } from "./inline"

const AVAILABLE = TRANSLATION_LANGUAGES.map((l) => l.code)
const INLINE_RESULTS_LIMIT = 5

export interface BotReply {
    chatId: number
    html: string
}

export type BotResponse =
    | { kind: "message"; chatId: number; html: string }
    | { kind: "inline"; queryId: string; results: InlineArticleResult[] }

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<BotResponse | null> {
    const inline = telegramUpdateToInlineQuery(update)
    if (inline) {
        const locale = toBotLocale(inline.languageCode)
        const key = `${locale}:${inline.query.trim().toLowerCase()}`
        const cached = cachedInlineResults(key)
        const results = cached ?? await buildInlineResults(inline.query, inline.languageCode, locale)
        if (!cached) storeInlineResults(key, results)
        return { kind: "inline", queryId: inline.queryId, results }
    }

    const parsed = telegramUpdateToCommand(update)
    if (!parsed) return null
    const reply = await runMessage(parsed.cmd, parsed.chatId, parsed.languageCode)
    return reply ? { kind: "message", ...reply } : null
}

async function runMessage(cmd: Parameters<typeof runCommand>[0], chatId: number, languageCode?: string): Promise<BotReply | null> {
    try {
        const msg = await runCommand(cmd, {
            languageCode,
            botName: process.env.TELEGRAM_BOT_NAME,
        })
        return { chatId, html: toTelegramHtml(msg) }
    } catch (err) {
        console.error("[bots/telegram] runCommand failed:", err)
        return { chatId, html: "⚠️ Something went wrong, please try again later." }
    }
}

/** Инлайн-результаты: пустой запрос — слово дня; `/команда` — ответ команды ядра
 *  (одна карточка); иначе до 5 карточек из поиска. */
async function buildInlineResults(query: string, languageCode: string | undefined, locale: BotLocale): Promise<InlineArticleResult[]> {
    try {
        const languages = translationLanguages(languageCode, AVAILABLE)
        const script: Script = isCyrillicText(query) ? "cyr" : "lat"
        const trimmed = query.trim()
        if (!trimmed) {
            const id = await getWordOfDayId()
            const entry = id ? await loadEntryById(id, languages) : null
            return entry ? [messageToInlineResult(entryMessage(entry, locale, "lat"), 0)] : []
        }
        // `/today`, `/forms`, `/cyr`, `/lat`, `/help` — та же команда, что в личке.
        if (trimmed.startsWith("/")) {
            const msg = await runCommand(textToCommand(trimmed), { languageCode, botName: process.env.TELEGRAM_BOT_NAME })
            return [messageToInlineResult(msg, 0)]
        }
        const result = await lookupWord(trimmed, languages)
        return result.entries.slice(0, INLINE_RESULTS_LIMIT).map((e, i) => messageToInlineResult(entryMessage(e, locale, script), i))
    } catch (err) {
        console.error("[bots/telegram] inline query failed:", err)
        return []
    }
}
