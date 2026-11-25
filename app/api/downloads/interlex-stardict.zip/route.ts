import { init } from "@/lib/sqlite"
import { buildStardict, STARDICT_ARCHIVE } from "@/lib/export/lexicon/stardict"

export const runtime = "nodejs"

async function generateArchive() {
    const db = await init()
    try {
        return (await buildStardict(db)).toBufferPromise()
    } finally {
        db.close()
    }
}

// Requests that overlap share one export. Later downloads read current published entries.
let inFlight: ReturnType<typeof generateArchive> | undefined

export async function GET() {
    inFlight ??= generateArchive().finally(() => { inFlight = undefined })
    const archive = await inFlight
    return new Response(new Uint8Array(archive), {
        headers: {
            "Content-Type": "application/zip",
            "Content-Length": String(archive.length),
            "Content-Disposition": `attachment; filename="${STARDICT_ARCHIVE}"`,
            "Cache-Control": "no-store",
        },
    })
}
