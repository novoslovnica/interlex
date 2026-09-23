import { describe, expect, it } from "vitest"
import { buildHunspell, expandHunspell, NEEDAFFIX_FLAG } from "./compress"

const options = { map: ["eě", "cčć"], rep: [["dj", "đ"]] as [string, string][], wordChars: "-", header: ["test"] }

describe("buildHunspell", () => {
    const lexemes = [
        ["voda", "vody", "vodu", "vodě", "vodoju", "vod"],
        ["žena", "ženy", "ženu", "ženě", "ženoju", "žen"],
        ["pisati", "pišu", "piše", "pisal"],
        ["a"],
        ["i", "iz"],
    ]
    const dict = buildHunspell(lexemes, options)

    it("round-trips: expanding the files gives exactly the input words", () => {
        expect(expandHunspell(dict.aff, dict.dic)).toEqual(new Set(lexemes.flat()))
    })

    it("shares one class between lexemes with the same endings", () => {
        expect(dict.dic).toMatch(/^vod\/(\d+)$/m)
        const vodFlag = /^vod\/(\d+)$/m.exec(dict.dic)![1]
        expect(dict.dic).toContain(`žen/${vodFlag}`)
    })

    it("marks a stem that is not a word itself with NEEDAFFIX", () => {
        // "pis"/"piš": общий префикс "pi" сам словом не является.
        expect(dict.dic).toMatch(new RegExp(`^pi/${NEEDAFFIX_FLAG},\\d+$`, "m"))
        expect(expandHunspell(dict.aff, dict.dic).has("pi")).toBe(false)
    })

    it("writes a valid header and count line", () => {
        expect(dict.aff).toMatch(/^# test\nSET UTF-8\nFLAG num\n/)
        expect(dict.aff).toContain("MAP 2\nMAP eě\nMAP cčć")
        expect(Number(dict.dic.split("\n")[0])).toBe(dict.stats.entries)
    })

    it("skips words with spaces or slashes", () => {
        const d = buildHunspell([["sę li", "a/b", "da"]], options)
        expect(expandHunspell(d.aff, d.dic)).toEqual(new Set(["da"]))
    })
})
