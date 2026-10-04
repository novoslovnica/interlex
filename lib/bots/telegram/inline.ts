// BotMessage -> InlineQueryResultArticle для answerInlineQuery. Плюс кэш:
// инлайн-режим шлёт запрос на КАЖДЫЙ введённый символ, поэтому без кэша
// каждое нажатие клавиши — поиск по словарю.

import type { BotMessage } from "@/lib/bots/core/message"
import { toTelegramHtml } from "@/lib/bots/core/message"

export interface InlineArticleResult {
    type: "article"
    id: string
    title: string
    description?: string
    input_message_content: { message_text: string; parse_mode: "HTML" }
    reply_markup?: { inline_keyboard: { text: string; url: string }[][] }
}

export function messageToInlineResult(msg: BotMessage, index: number): InlineArticleResult {
    const description = [msg.subtitle ?? "", msg.lines[0] ?? ""].filter(Boolean).join(" — ").slice(0, 200)
    return {
        type: "article",
        id: String(index),
        title: (msg.title || "Interslavic Lexicon").slice(0, 256),
        ...(description ? { description } : {}),
        input_message_content: { message_text: toTelegramHtml(msg), parse_mode: "HTML" },
        ...(msg.link ? { reply_markup: { inline_keyboard: [[{ text: msg.link.label, url: msg.link.url }]] } } : {}),
    }
}

const CACHE_TTL_MS = 5 * 60_000
const CACHE_MAX = 500
const cache = new Map<string, { at: number; results: InlineArticleResult[] }>()

export function cachedInlineResults(key: string): InlineArticleResult[] | null {
    const hit = cache.get(key)
    if (!hit) return null
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        cache.delete(key)
        return null
    }
    return hit.results
}

export function storeInlineResults(key: string, results: InlineArticleResult[]): void {
    if (cache.size >= CACHE_MAX) {
        // FIFO: Map сохраняет порядок вставки, первый элемент — самый старый.
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, { at: Date.now(), results })
}
