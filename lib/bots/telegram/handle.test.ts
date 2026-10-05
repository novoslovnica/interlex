// handleTelegramUpdate: сервис и (бывший) webhook-роут используют один обработчик —
// сообщения, инлайн-запросы, ветка ошибки runCommand.

import { describe, expect, it, vi } from "vitest"

const runCommandMock = vi.hoisted(() => vi.fn())
const lookupWordMock = vi.hoisted(() => vi.fn())
const loadEntryByIdMock = vi.hoisted(() => vi.fn())
const getWordOfDayIdMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/bots/core/commands", () => ({
    runCommand: runCommandMock,
}))
vi.mock("@/lib/bots/core/lookup", () => ({
    lookupWord: lookupWordMock,
    loadEntryById: loadEntryByIdMock,
}))
vi.mock("@/lib/bots/core/wordOfDay", () => ({
    getWordOfDayId: getWordOfDayIdMock,
}))

import { handleTelegramUpdate } from "./handle"
import type { TelegramUpdate } from "./update"

const textUpdate = (text: string): TelegramUpdate => ({
    message: { text, chat: { id: 42 }, from: { id: 7, language_code: "ru" } },
})

const inlineUpdate = (query: string): TelegramUpdate => ({
    inline_query: { id: 999, query, from: { language_code: "ru" } },
})

describe("handleTelegramUpdate / message", () => {
    it("returns null for updates without a command (stickers etc.)", async () => {
        expect(await handleTelegramUpdate({ message: { chat: { id: 1 } } })).toBeNull()
    })

    it("returns HTML reply on success", async () => {
        runCommandMock.mockResolvedValueOnce({ title: "voda", lines: ["water"] })
        const reply = await handleTelegramUpdate(textUpdate("voda"))
        expect(reply?.kind).toBe("message")
        if (reply?.kind !== "message") return
        expect(reply.chatId).toBe(42)
        expect(reply.html).toContain("voda")
    })

    it("returns a polite error message when runCommand throws", async () => {
        runCommandMock.mockRejectedValueOnce(new Error("db down"))
        const reply = await handleTelegramUpdate(textUpdate("voda"))
        if (reply?.kind !== "message") throw new Error("expected message reply")
        expect(reply.chatId).toBe(42)
        expect(reply.html).toContain("Something went wrong")
    })
})

describe("handleTelegramUpdate / inline query", () => {
    it("answers with article results from lookupWord", async () => {
        lookupWordMock.mockResolvedValueOnce({
            query: "voda",
            latinQuery: "voda",
            via: "exact",
            entries: [
                { id: 1, value: "voda", pos: "NOUN", gender: "Fem", translations: [{ language: "ru", values: ["вода"] }], meanings: [], allophones: [] },
                { id: 2, value: "vodž", pos: "NOUN", gender: "Masc", translations: [{ language: "ru", values: ["вождь"] }], meanings: [], allophones: [] },
            ],
            formReadings: [],
        })
        const reply = await handleTelegramUpdate(inlineUpdate("voda"))
        if (reply?.kind !== "inline") throw new Error("expected inline reply")
        expect(reply.queryId).toBe("999")
        expect(reply.results).toHaveLength(2)
        expect(reply.results[0].type).toBe("article")
        expect(reply.results[0].title).toContain("voda")
        expect(reply.results[0].input_message_content.parse_mode).toBe("HTML")
        expect(reply.results[0].reply_markup?.inline_keyboard[0][0].url).toContain("/words/1")
    })

    it("caches results per locale+query (second call does not hit lookupWord)", async () => {
        lookupWordMock.mockResolvedValueOnce({ query: "voda", latinQuery: "voda", via: "exact", entries: [], formReadings: [] })
        await handleTelegramUpdate(inlineUpdate("voda"))
        const reply = await handleTelegramUpdate(inlineUpdate("voda"))
        expect(reply?.kind).toBe("inline")
        expect(lookupWordMock).toHaveBeenCalledTimes(1)
    })

    it("returns word of the day for an empty query", async () => {
        getWordOfDayIdMock.mockResolvedValueOnce(123)
        loadEntryByIdMock.mockResolvedValueOnce({ id: 123, value: "dobro", pos: "ADV", translations: [], meanings: [], allophones: [] })
        const reply = await handleTelegramUpdate(inlineUpdate(""))
        if (reply?.kind !== "inline") throw new Error("expected inline reply")
        expect(reply.results).toHaveLength(1)
        expect(reply.results[0].title).toContain("dobro")
    })

    it("routes a /command inline through runCommand (one card)", async () => {
        runCommandMock.mockResolvedValueOnce({ title: "Слово дня: dobro", lines: ["word of the day"] })
        const reply = await handleTelegramUpdate(inlineUpdate("/today"))
        if (reply?.kind !== "inline") throw new Error("expected inline reply")
        expect(runCommandMock).toHaveBeenCalledWith({ kind: "today" }, expect.objectContaining({ languageCode: "ru" }))
        expect(reply.results).toHaveLength(1)
        expect(reply.results[0].title).toContain("Слово дня")
    })

    it("returns empty results when lookupWord throws (inline must not crash)", async () => {
        lookupWordMock.mockRejectedValueOnce(new Error("db down"))
        const reply = await handleTelegramUpdate(inlineUpdate("zzzzz"))
        if (reply?.kind !== "inline") throw new Error("expected inline reply")
        expect(reply.results).toEqual([])
    })
})
