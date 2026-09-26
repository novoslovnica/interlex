// handleTelegramUpdate: webhook и поллер используют один обработчик —
// проверяем маппинг на null, успешный ответ и ветку ошибки runCommand.

import { describe, expect, it, vi } from "vitest"

const runCommandMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/bots/core/commands", () => ({
    runCommand: runCommandMock,
}))

import { handleTelegramUpdate } from "./handle"
import type { TelegramUpdate } from "./update"

const textUpdate = (text: string): TelegramUpdate => ({
    message: { text, chat: { id: 42 }, from: { id: 7, language_code: "ru" } },
})

describe("handleTelegramUpdate", () => {
    it("returns null for updates without a command (stickers etc.)", async () => {
        expect(await handleTelegramUpdate({ message: { chat: { id: 1 } } })).toBeNull()
    })

    it("returns HTML reply on success", async () => {
        runCommandMock.mockResolvedValueOnce({ title: "voda", lines: ["water"] })
        const reply = await handleTelegramUpdate(textUpdate("voda"))
        expect(reply?.chatId).toBe(42)
        expect(reply?.html).toContain("voda")
    })

    it("returns a polite error message when runCommand throws", async () => {
        runCommandMock.mockRejectedValueOnce(new Error("db down"))
        const reply = await handleTelegramUpdate(textUpdate("voda"))
        expect(reply?.chatId).toBe(42)
        expect(reply?.html).toContain("Something went wrong")
    })
})
