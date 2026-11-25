import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/main/stats", () => ({
    getMainStats: async () => ({ words: 21278, totalTokens: 7543398 }),
}))

import { GET } from "./route"

describe("embeddable statistics badge", () => {
    it("renders a public cacheable image from the same counts as the homepage", async () => {
        const response = await GET(new Request("https://example.test/api/stats/badge.svg?lang=ru"))
        expect(response.headers.get("content-type")).toContain("image/svg+xml")
        expect(response.headers.get("cache-control")).toContain("max-age=300")
        expect(response.headers.get("cross-origin-resource-policy")).toBe("cross-origin")
        const image = await response.text()
        expect(image).toContain("21\u00a0278 слов")
        expect(image).toContain("7\u00a0543\u00a0398 токенов корпуса")
    })

    it("uses the default labels for an unsupported language", async () => {
        const response = await GET(new Request("https://example.test/api/stats/badge.svg?lang=%3Cscript%3E"))
        const image = await response.text()
        expect(image).toContain("21,278 words")
        expect(image).not.toContain("<script>")
    })
})
