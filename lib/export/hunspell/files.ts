import fs from "fs"
import path from "path"

// Что отдаётся с /api/downloads/<file>. Белый список: имя из URL никогда не
// превращается в путь напрямую.
export const HUNSPELL_FILES: Record<string, string> = {
    "isv-spellcheck.oxt": "application/vnd.openofficeorg.extension",
    "isv-hunspell.zip": "application/zip",
    "isv_Latn.dic": "text/plain; charset=utf-8",
    "isv_Latn.aff": "text/plain; charset=utf-8",
    "isv_Cyrl.dic": "text/plain; charset=utf-8",
    "isv_Cyrl.aff": "text/plain; charset=utf-8",
    "README.txt": "text/plain; charset=utf-8",
}

export function hunspellDir(): string {
    return path.resolve(process.cwd(), process.env.HUNSPELL_OUT_DIR || "exports/hunspell")
}

export interface HunspellMetadata {
    version: string
    builtAt: string
    commit: string | null
    lexemes: number
    stats: Record<string, { words: number; entries: number; classes: number }>
}

export function readHunspellMetadata(): HunspellMetadata | null {
    try {
        return JSON.parse(fs.readFileSync(path.join(hunspellDir(), "metadata.json"), "utf8")) as HunspellMetadata
    } catch {
        return null
    }
}

export function hunspellFileSize(name: string): number | null {
    try { return fs.statSync(path.join(hunspellDir(), name)).size } catch { return null }
}
