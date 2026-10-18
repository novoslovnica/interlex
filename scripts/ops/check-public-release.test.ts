import { expect, it, vi } from "vitest"
import { checkPublicRelease } from "./check-public-release.mjs"
function transport(mode: string) {
    return vi.fn<typeof fetch>(async (input) => {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url)
        if (url.pathname === "/api/health") return Response.json({ status: "ok", release: mode === "stale" ? "old" : "new" })
        if (url.pathname === "/") return new Response('<link href="/_next/static/app.css" rel="stylesheet"><script src="/_next/static/app.js"></script>')
        if (mode === "missing-chunk") return new Response(null, { status: 404 })
        return new Response("/* asset */", { headers: { "Content-Type": mode === "html-instead-of-js" ? "text/html" : url.pathname.endsWith(".css") ? "text/css" : "application/javascript" } })
    })
}
it("checks public release identity, homepage, JS and CSS without cache", async () => {
    const fetcher = transport("ok")
    await checkPublicRelease("https://site.example", "new", fetcher)
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
        "https://site.example/api/health", "https://site.example/",
        "https://site.example/_next/static/app.css", "https://site.example/_next/static/app.js",
    ])
    for (const [, options] of fetcher.mock.calls) expect(options?.cache).toBe("no-store")
})
it.each(["stale", "missing-chunk", "html-instead-of-js"])("refuses public %s responses", async (mode) => {
    await expect(checkPublicRelease("https://site.example", "new", transport(mode))).rejects.toThrow()
})
