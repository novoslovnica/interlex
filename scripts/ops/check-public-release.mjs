import path from "node:path"
import { fileURLToPath } from "node:url"

// A stale static alias can leave /api/health green while new JS/CSS returns 404.
/** @param {string} base @param {string} expected @param {typeof fetch} fetcher */
export async function checkPublicRelease(base, expected, fetcher = fetch) {
    /** @param {URL} url */
    async function read(url) {
        const response = await fetcher(url, { signal: AbortSignal.timeout(15000), cache: "no-store" })
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
        return response
    }
    const origin = new URL(base)
    const health = await (await read(new URL("/api/health", origin))).json()
    if (health.status !== "ok" || health.release !== expected) throw new Error("public endpoint serves a different release")
    const html = await (await read(origin)).text()
    /** @type {Map<string, string>} */
    const assets = new Map()
    for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"<>]+\.(js|css)(?:\?[^"<>]*)?)"/g)) {
        if (!assets.has(match[2])) assets.set(match[2], match[1])
    }
    if (!assets.has("js")) throw new Error("homepage has no Next.js scripts")
    await Promise.all([...assets].map(async ([type, asset]) => {
        const response = await read(new URL(asset.replaceAll("&amp;", "&"), origin))
        const mime = response.headers.get("content-type") ?? ""
        if (type === "js" ? !/javascript/.test(mime) : !mime.includes("text/css")) {
            throw new Error(`unexpected asset content type: ${mime}`)
        }
        await response.arrayBuffer()
    }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    try {
        await checkPublicRelease(process.argv[2], process.argv[3])
        console.log("OK: public release identity, homepage and JS/CSS assets")
    } catch (error) {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    }
}
