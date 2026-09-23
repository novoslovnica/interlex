import fs from "fs"
import path from "path"
import { NextResponse } from "next/server"
import { HUNSPELL_FILES, hunspellDir } from "@/lib/export/hunspell/files"

// Скачивание словарей проверки орфографии (scripts/export-hunspell.ts).
// Публично, без сессии: это распространяемый артефакт.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
    const { file } = await params
    const contentType = HUNSPELL_FILES[file]
    if (!contentType) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const filePath = path.join(hunspellDir(), file)
    let body: Buffer
    try {
        body = await fs.promises.readFile(filePath)
    } catch {
        return NextResponse.json({ error: "Not built yet" }, { status: 404 })
    }
    return new NextResponse(new Uint8Array(body), {
        headers: {
            "Content-Type": contentType,
            "Content-Length": String(body.length),
            // Имена файлов - ASCII, filename* не нужен.
            "Content-Disposition": `attachment; filename="${file}"`,
            "Cache-Control": "public, max-age=3600",
        },
    })
}
