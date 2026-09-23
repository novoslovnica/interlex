import { TRANSLATION_LANGUAGES } from "@/config/features"
import { toParadigmSource } from "@/lib/paradigm"
import { cyrillicToLatin, isCyrillicText, latinToCyrillic } from "@/lib/orthography/standard"
import { loadEntryById, loadLexemeRow, lookupWord } from "./lookup"
import { getWordOfDayId } from "./wordOfDay"
import { lookupMessage, paradigmMessage, wordOfDayMessage, type Script } from "./compose"
import type { BotMessage } from "./message"
import { t, toBotLocale, translationLanguages } from "./labels"

// Команды ботов, общие для Telegram и Discord. Платформа разбирает свой
// апдейт в BotCommand, вызывает runCommand и рисует BotMessage.

export type BotCommand =
    | { kind: "lookup"; query: string }
    | { kind: "forms"; query: string }
    | { kind: "cyr"; text: string }
    | { kind: "lat"; text: string }
    | { kind: "today" }
    | { kind: "help" }

export interface BotContext {
    /** Язык пользователя на платформе (language_code / locale). */
    languageCode?: string | null
    /** Имя бота для подсказки про инлайн-режим. */
    botName?: string
}

const AVAILABLE = TRANSLATION_LANGUAGES.map((l) => l.code)

let prepositions: Promise<string[]> | null = null
function knownPrepositions(): Promise<string[]> {
    // Нужны глаголам с предлогом в хвосте ("zaviseti od"), см. lib/paradigm.ts.
    prepositions ??= import("@/lib/corpus/tokenizer/analyzer-factory").then((m) => m.buildKnownPrepositions()).catch(() => { prepositions = null; return [] })
    return prepositions
}

function scriptOf(text: string): Script {
    return isCyrillicText(text) ? "cyr" : "lat"
}

export async function runCommand(cmd: BotCommand, ctx: BotContext): Promise<BotMessage> {
    const locale = toBotLocale(ctx.languageCode)
    const L = t(locale)
    const languages = translationLanguages(ctx.languageCode, AVAILABLE)

    switch (cmd.kind) {
        case "help":
            return { title: "Interslavic Lexicon", lines: [L.help.replace("{bot}", ctx.botName ?? "bot")] }
        case "cyr":
            if (!cmd.text.trim()) return { title: "/cyr", lines: [L.usage("cyr")] }
            return { title: "", lines: [latinToCyrillic(cmd.text)] }
        case "lat":
            if (!cmd.text.trim()) return { title: "/lat", lines: [L.usage("lat")] }
            return { title: "", lines: [cyrillicToLatin(cmd.text)] }
        case "today": {
            const id = await getWordOfDayId()
            const entry = id ? await loadEntryById(id, languages) : null
            if (!entry) return { title: L.wordOfDay, lines: ["—"] }
            return wordOfDayMessage(entry, locale, "lat")
        }
        case "lookup": {
            if (!cmd.query.trim()) return { title: "", lines: [L.help.replace("{bot}", ctx.botName ?? "bot")] }
            return lookupMessage(await lookupWord(cmd.query, languages), locale, scriptOf(cmd.query))
        }
        case "forms": {
            if (!cmd.query.trim()) return { title: "/forms", lines: [L.usage("forms")] }
            const result = await lookupWord(cmd.query, languages)
            const first = result.entries[0]
            if (!first || result.via === "fuzzy") return lookupMessage(result, locale, scriptOf(cmd.query))
            const row = await loadLexemeRow(first.id)
            if (!row) return lookupMessage(result, locale, scriptOf(cmd.query))
            const src = { ...toParadigmSource(row), pos: (row.pos as string | null)?.toUpperCase() ?? null, id: first.id }
            return paradigmMessage(src, src.pos === "VERB" ? await knownPrepositions() : [], locale, scriptOf(cmd.query))
        }
    }
}
