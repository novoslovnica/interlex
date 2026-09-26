import { describe, expect, it } from "vitest"
import { telegramUpdateToCommand, textToCommand, type TelegramUpdate } from "./update"

function update(text: string, extra?: Partial<NonNullable<TelegramUpdate["message"]>>): TelegramUpdate {
    return {
        message: {
            text,
            chat: { id: 42 },
            from: { id: 7, language_code: "ru" },
            ...extra,
        },
    }
}

describe("textToCommand", () => {
    it("maps /start and /help to help", () => {
        expect(textToCommand("/start")).toEqual({ kind: "help" })
        expect(textToCommand("/help")).toEqual({ kind: "help" })
    })
    it("strips the @bot suffix", () => {
        expect(textToCommand("/today@InterslavicBot")).toEqual({ kind: "today" })
        expect(textToCommand("/forms@InterslavicBot voda")).toEqual({ kind: "forms", query: "voda" })
    })
    it("maps /forms with an argument", () => {
        expect(textToCommand("/forms voda")).toEqual({ kind: "forms", query: "voda" })
    })
    it("maps empty /forms to help (usage hint lives in the help text)", () => {
        expect(textToCommand("/forms")).toEqual({ kind: "help" })
    })
    it("maps /cyr and /lat with text", () => {
        expect(textToCommand("/cyr voda")).toEqual({ kind: "cyr", text: "voda" })
        expect(textToCommand("/lat вода")).toEqual({ kind: "lat", text: "вода" })
    })
    it("maps plain text to lookup", () => {
        expect(textToCommand("voda")).toEqual({ kind: "lookup", query: "voda" })
    })
})

describe("telegramUpdateToCommand", () => {
    it("parses chat id, command and language code", () => {
        expect(telegramUpdateToCommand(update("voda"))).toEqual({ chatId: 42, cmd: { kind: "lookup", query: "voda" }, languageCode: "ru" })
    })
    it("returns null for non-text updates (photo, sticker)", () => {
        const u: TelegramUpdate = { message: { chat: { id: 1 } } }
        expect(telegramUpdateToCommand(u)).toBeNull()
        expect(telegramUpdateToCommand({})).toBeNull()
    })
    it("ignores messages from bots", () => {
        expect(telegramUpdateToCommand(update("voda", { from: { id: 1, is_bot: true } }))).toBeNull()
    })
    it("omits languageCode when absent", () => {
        const u = telegramUpdateToCommand(update("/today", { from: { id: 7 } }))
        expect(u).toEqual({ chatId: 42, cmd: { kind: "today" } })
    })
})
