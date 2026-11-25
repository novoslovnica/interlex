import { init } from "@/lib/sqlite"
import { streamLexiconCsv } from "@/lib/export/lexicon/csv"

export const runtime = "nodejs"

export async function GET() {
    const db = await init()
    return new Response(streamLexiconCsv(db), {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="interlex-lexicon.csv"',
            "Cache-Control": "no-store",
        },
    })
}
