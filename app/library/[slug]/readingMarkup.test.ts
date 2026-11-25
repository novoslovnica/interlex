import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MarkdownRenderer } from "./MarkdownRenderer"

describe("library reading markup", () => {
    it("preserves punctuation and formatting and leaves links, code and raw URLs alone", () => {
        const content = "Dobrý **dėnj**, чловѣк! [link](/words/1) `code` https://example.org A1.\n\n```ts\nconst x = 1\n```"
        const html = renderToStaticMarkup(createElement(MarkdownRenderer, { content, dialogId: "reader" }))
        expect([...html.matchAll(/data-reading-word="([^"]+)"/g)].map(match => match[1])).toEqual(["Dobrý", "dėnj", "чловѣк"])
        expect(html.match(/tabindex="0"/g)).toHaveLength(1)
        expect(html).toContain('aria-controls="reader"')
        expect(html).toContain("</button>!")
        expect(html).toContain("<strong><button")
        expect(html).toContain('<a href="/words/1">link</a>')
        expect(html).toContain("<code>code</code> https://example.org A1.")
        expect(html).toContain('<pre><code class="language-ts">const x = 1')
    })

    it("keeps plain Markdown when the reader mode is off", () => {
        expect(renderToStaticMarkup(createElement(MarkdownRenderer, { content: "**język**" }))).toBe("<p><strong>język</strong></p>")
    })
})

it("marks only known words above the selected threshold and exposes their level to assistive technology", () => {
    const html = renderToStaticMarkup(createElement(MarkdownRenderer, {
        content: "RŲKA dom neznamo [слово](/words/1)",
        dialogId: "reader",
        levels: { rųka: "B1", dom: "A1", слово: "B1" },
        threshold: "A2",
    }))
    expect(html.match(/data-difficulty=/g)).toHaveLength(1)
    expect(html).toContain('aria-label="RŲKA (B1)"')
    expect(html).toContain("decoration-double")
    expect(html).toContain('<a href="/words/1">слово</a>')
})
