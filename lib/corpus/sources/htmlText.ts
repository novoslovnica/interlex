const NAMED_ENTITIES: Record<string, string> = {
    nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
    rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©",
}

function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
        if (code[0] === "#") {
            const codePoint = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
        }
        return NAMED_ENTITIES[code.toLowerCase()] ?? match
    })
}

const BLOCK_TAGS = /<\/(p|div|li|h[1-6]|tr|blockquote|article|section)>/gi
const BREAK_TAGS = /<br\s*\/?>/gi

/**
 * Грубый HTML→текст: вырезает script/style/тэги, декодирует entity, вставляет
 * двойной перевод строки на границах блочных элементов. Этого достаточно для
 * новостных статей (в основном простые p/h2/li без вложенной вёрстки) — не
 * претендует на точный рендеринг произвольного HTML.
 */
export function htmlToPlainText(html: string): string {
    let text = html
        .replace(/<(script|style|button|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(BREAK_TAGS, "\n")
        .replace(BLOCK_TAGS, "\n\n")
        .replace(/<[^>]+>/g, " ")

    text = decodeHtmlEntities(text)

    return text
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

const CYRILLIC_RE = /[Ѐ-ӿ]/g
const LATIN_RE = /[a-zA-Zа-яёA-ZĀ-žА-ЯĀ-ſ]/g

/**
 * Некоторые источники (напр. izvesti.info) публикуют один и тот же абзац
 * параллельно на латинице и на кириллице. Грамматический движок и словарь
 * (lib/grammar/*) работают с латинской орфографией — кириллические дубли
 * абзацев только шумят в корпусе и не токенизируются осмысленно, поэтому
 * отбрасываем абзацы, где кириллица преобладает над латиницей.
 */
export function filterLatinParagraphs(text: string): string {
    return text
        .split(/\n{2,}/)
        .filter((paragraph) => {
            const cyrillicCount = (paragraph.match(CYRILLIC_RE) ?? []).length
            const latinCount = (paragraph.match(LATIN_RE) ?? []).length
            return cyrillicCount <= latinCount
        })
        .join("\n\n")
        .trim()
}

/**
 * Небольшой детерминированный хэш (умещается в 32-битный Int), используемый
 * как псевдо-revision для источников без собственного номера версии —
 * позволяет краулеру пропускать неизменившиеся статьи при повторных запусках.
 */
export function contentHash(text: string): number {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
        hash = (hash * 31 + text.charCodeAt(i)) | 0
    }
    return hash
}
