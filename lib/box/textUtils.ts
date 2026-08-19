import { createHash } from "crypto"

export function slugify(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60)
}

export function shortHash(input: string): string {
    return createHash("sha1").update(input).digest("hex").slice(0, 8)
}

/** Стабильный, гарантированно уникальный slug на основе исходного пути файла в Box. */
export function stableSlug(title: string, relPath: string): string {
    const base = slugify(title) || "text"
    return `${base}-${shortHash(relPath)}`
}

/**
 * Имена файлов в коллекции размечены языковым тегом в квадратных скобках:
 * "[isv] Melac - Ljubov jest kako burja.txt", "[ru] ...". Файлы без тега
 * (izvesti.info, "Slovjani.info (slabe teksty)", "Игорь Соколов" — проверено
 * вручную на полном списке, других непомеченных файлов в коллекции нет)
 * тоже на межславянском.
 */
export function parseLangTag(filename: string): { tag: string | null; rest: string } {
    const m = filename.match(/^\[([a-z]{2,3})\]\s*/i)
    if (!m) return { tag: null, rest: filename }
    return { tag: m[1].toLowerCase(), rest: filename.slice(m[0].length) }
}

const EXCLUDE_NAME_PATTERNS = [
    /kung\s*fjuri/i, // фан-субтитры к фильму DreamWorks - авторские права не выяснены
    /havking|hawking/i, // "Kratša historija časa" - перевод книги Хокинга, только в библиотеку (isPublic=false), не в публичный корпус
]

export function isExcludedFromCorpus(name: string): boolean {
    return EXCLUDE_NAME_PATTERNS.some((p) => p.test(name))
}

const TEXT_EXTENSIONS = /\.(txt|md|srt)$/i

export function isCandidateTextFile(relPath: string): boolean {
    return TEXT_EXTENSIONS.test(relPath)
}

/** true для файлов на межславянском (isv-тег или один из непомеченных источников). */
export function isIsvTextFile(relPath: string): boolean {
    if (!isCandidateTextFile(relPath)) return false
    const name = relPath.split("/").pop() || relPath
    const { tag } = parseLangTag(name)
    return tag === null || tag === "isv"
}

export function stripExt(name: string): string {
    return name.replace(/\.(txt|md|srt)$/i, "")
}

/**
 * Лёгкая чистка markdown-разметки для .md-файлов коллекции - без этого в
 * текст корпуса/библиотеки утекают "#", "**", и особенно битые локальные
 * пути картинок вида "![img](C:\Users\...\image.jpeg)" (Typora-экспорт),
 * которые токенизатор считал бы обычными "словами".
 */
export function stripMarkdown(text: string): string {
    return text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // ![alt](path) - целиком, путь не нужен
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) -> text
        .replace(/^#{1,6}\s*/gm, "") // # Заголовок -> Заголовок
        .replace(/(\*\*|__)(.*?)\1/g, "$2") // **bold**/__bold__
        .replace(/(\*|_)(.*?)\1/g, "$2") // *italic*/_italic_
        .replace(/^>\s?/gm, "") // > цитата
        .replace(/^[ \t]*[-*+]\s+/gm, "") // - маркер списка
        .replace(/`([^`]*)`/g, "$1") // `code`
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

/**
 * "Melac - Ljubov jest kako burja" -> {author: "Melac", title: "Ljubov jest kako burja"}.
 * Если разделителя нет - вся строка идёт в title, author не угадывается.
 */
export function parseAuthorTitle(nameWithoutTagExt: string): { author: string | null; title: string } {
    const m = nameWithoutTagExt.match(/^([^-]{2,40}?)\s+-\s+(.+)$/)
    if (!m) return { author: null, title: nameWithoutTagExt.trim() }
    return { author: m[1].trim(), title: m[2].trim() }
}

/** Первая непустая строка текста - в этой коллекции она обычно и есть заголовок. */
export function firstNonEmptyLine(text: string): string | null {
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (trimmed) return trimmed.slice(0, 200)
    }
    return null
}
