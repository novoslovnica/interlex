// display(): канон — этимологическая орфография (без знаков ударения);
// кириллица — стандартная. paradigmMessage: у существительных три числа
// (ед./дв./мн.).

import { describe, expect, it } from "vitest"
import { display, paradigmMessage } from "./compose"
import { toBotLocale } from "./labels"

describe("display", () => {
    it("keeps etymological spelling (canonical), only strips stress marks", () => {
        expect(display("język", "lat")).toBe("język")
        expect(display("stoleťa", "lat")).toBe("stoleťa")
        expect(display("sųt", "lat")).toBe("sųt")
        expect(display("vođa", "lat")).toBe("vođa")
    })
    it("strips combining accent marks", () => {
        expect(display("vòda", "lat")).toBe("voda")
        expect(display("nȅsl", "lat")).toBe("nesl")
    })
    it("converts to standard Cyrillic", () => {
        expect(display("język", "cyr")).toBe("језык")
        expect(display("stolěťa", "cyr")).toBe("столєтја")
    })
})

describe("paradigmMessage / noun", () => {
    it("renders singular, dual and plural columns", () => {
        const msg = paradigmMessage(
            { id: 1, pos: "NOUN", value: "voda", stem: "vod", gender: "Fem", protoStemClass: "ā", paradigm: "A" },
            [],
            toBotLocale("ru"),
            "lat",
        )
        expect(msg.table).toBeDefined()
        const header = msg.table![0]
        expect(header).toHaveLength(4)
        // Строка именительного падежа: ед., дв., мн. — все три заполнены.
        const nom = msg.table!.find((row) => row[0] === "Им.")!
        expect(nom[1]).toBe("voda")
        expect(nom[2]).not.toBe("—")
        expect(nom[3]).not.toBe("—")
        // Двойственное число этимологическое (не упрощённое): столетья-подобных
        // слов здесь нет, но ľ/ń/ť сохраняются в любой строке, если встречаются.
    })
})
