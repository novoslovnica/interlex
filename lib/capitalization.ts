// Регистр первой буквы перевода. Общее для скрипта нормализации
// (scripts/db/2026-09-19-normalize-translation-capitalization.ts) и страницы
// разбора имён собственных (/admin/proper-nouns): правило одно - "перевод
// пишется с заглавной, только если у лексемы стоит properNoun".

export const isUpperLetter = (ch: string | undefined): boolean => !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase()
export const firstLetter = (text: string): string | undefined => text.trimStart()[0]
export const isAllCaps = (text: string): boolean => {
    const letters = text.replace(/[^\p{L}]/gu, "")
    return letters.length > 1 && letters === letters.toUpperCase()
}

// Варианты внутри значения разделены запятой, точкой с запятой или косой чертой.
export const VARIANT_SEPARATOR = /[,;/]/

// Первая буква каждого варианта - в нижний регистр; аббревиатуры (USA, VIP)
// и варианты из `keep` не трогаются.
export function lowercaseVariants(value: string, keep?: Set<string>): string {
    return value.split(/([,;/])/).map((part) => {
        if (part === "," || part === ";" || part === "/" || isAllCaps(part) || keep?.has(part.trim())) return part
        const index = part.search(/\S/)
        if (index < 0 || !isUpperLetter(part[index])) return part
        return part.slice(0, index) + part[index].toLowerCase() + part.slice(index + 1)
    }).join("")
}

// Языки, где заглавная буква не признак имени собственного: немецкий пишет
// так все существительные, а nl/cu/eo решено не трогать (см. скрипт).
export const CAPITALIZATION_SKIPPED_LANGUAGES = new Set(["de", "nl", "cu", "eo"])
