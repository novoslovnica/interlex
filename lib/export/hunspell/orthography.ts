// Написания словоформы для словарей проверки орфографии.
//
// Движок порождает формы в этимологической орфографии (ę, ų, ė, ȯ, å, ŕ,
// мягкие ľ/ń/ť), а пишут на межславянском официальной стандартной - это
// видно по корпусу: jezyk 9 459 против język 349, sut 22 139 против sųt 1 771,
// prijatelj/konj/stolětja вместо prijateľ/koń/stoleťa, medžuslovjansky 3 887
// против međuslovjansky 38, člověk 2 530 против človek 315. Кириллица в
// корпусе - стандартная с ј (језык, сут, меджусловјанскы), а не та, что
// показывает сайт (isvToCyr: іезык), поэтому существующие конвертеры из
// lib/isv.ts и lib/transliteration.ts здесь не годятся.
//
// Первое написание в списке - стандартное (к нему ведут подсказки), остальные -
// принятые варианты: упрощённое ě→e, i вместо y, необязательные ć/đ.

const ETYM_TO_STANDARD: Record<string, string> = {
    "ę": "e", "Ę": "E", "ų": "u", "Ų": "U", "ǫ": "u", "Ǫ": "U",
    "ė": "e", "Ė": "E", "ȯ": "o", "Ȯ": "O", "å": "a", "Å": "A",
    "ĺ": "l", "Ĺ": "L", "ś": "s", "Ś": "S", "ź": "z", "Ź": "Z",
    "đ": "dž", "Đ": "Dž", "ć": "č", "Ć": "Č",
}

// Знаки ударения, которые могли остаться в форме (движок снимает не все: "tògda").
// Снимаются посимвольно и только с букв вне таблицы - иначе NFD разобрал бы
// и ć/ś/ń на букву + акут.
const STRESS_MARKS = /[̀́̂̑̏]/g
const PROTECTED = new Set([..."čćđěšžČĆĐĚŠŽľĽńŃťŤďĎŕŔ", ...Object.keys(ETYM_TO_STANDARD)])

function stripStress(text: string): string {
    let out = ""
    for (const ch of text.normalize("NFC")) {
        out += PROTECTED.has(ch) ? ch : ch.normalize("NFD").replace(STRESS_MARKS, "").normalize("NFC")
    }
    return out
}

function mapChars(text: string, table: Record<string, string>, keep: Set<string> = new Set()): string {
    let out = ""
    for (const ch of text) out += keep.has(ch) ? ch : (table[ch] ?? ch)
    return out
}

// Мягкие согласные: перед гласной - с j (prijatelja, stolětja, morja), перед
// согласной - твёрдая буква (međuslovjańsky -> medžuslovjansky), на конце
// слова l и n сохраняют мягкость (prijatelj, konj), t/d/r - нет (pęť -> pet).
const SOFT: Record<string, { plain: string; beforeVowel: string; final: string }> = {
    "ľ": { plain: "l", beforeVowel: "lj", final: "lj" }, "Ľ": { plain: "L", beforeVowel: "Lj", final: "Lj" },
    "ń": { plain: "n", beforeVowel: "nj", final: "nj" }, "Ń": { plain: "N", beforeVowel: "Nj", final: "Nj" },
    "ť": { plain: "t", beforeVowel: "tj", final: "t" }, "Ť": { plain: "T", beforeVowel: "Tj", final: "T" },
    "ď": { plain: "d", beforeVowel: "dj", final: "d" }, "Ď": { plain: "D", beforeVowel: "Dj", final: "D" },
    "ŕ": { plain: "r", beforeVowel: "rj", final: "r" }, "Ŕ": { plain: "R", beforeVowel: "Rj", final: "R" },
}
const VOWEL = /[aeiouyěęųǫėȯåAEIOUYĚĘŲǪĖȮÅ]/

function resolveSoft(text: string): string {
    const chars = [...text]
    let out = ""
    for (let i = 0; i < chars.length; i++) {
        const soft = SOFT[chars[i]]
        if (!soft) { out += chars[i]; continue }
        const next = chars[i + 1]
        out += next === undefined ? soft.final : VOWEL.test(next) ? soft.beforeVowel : soft.plain
    }
    return out
}

/** Стандартная латиница: ě, č, š, ž, y сохраняются, всё этимологическое снимается. */
export function toStandardLatin(etym: string): string {
    return mapChars(resolveSoft(stripStress(etym)), ETYM_TO_STANDARD)
}

/** Все сочетания "правило применено / не применено" для правил, которые встречаются в слове. */
function expand(word: string, optional: [RegExp, string][]): string[] {
    let results = [word]
    for (const [pattern, replacement] of optional) {
        const next: string[] = []
        for (const w of results) {
            next.push(w)
            pattern.lastIndex = 0
            if (pattern.test(w)) next.push(w.replace(pattern, replacement))
        }
        results = next
    }
    return [...new Set(results)]
}

const LATIN_VARIANTS: [RegExp, string][] = [
    [/ě/g, "e"], [/Ě/g, "E"],
    [/y/g, "i"], [/Y/g, "I"],
]

export function latinSpellings(etym: string): string[] {
    const cleaned = stripStress(etym)
    const standard = toStandardLatin(cleaned)
    // Необязательные буквы стандарта: ć и đ пишут и так (noć, međuslovjansky).
    const withOptional = mapChars(resolveSoft(cleaned), ETYM_TO_STANDARD, new Set(["ć", "Ć", "đ", "Đ"]))
    const all = [...expand(standard, LATIN_VARIANTS), ...expand(withOptional, LATIN_VARIANTS)]
    return [...new Set(all)].filter(isPlainLatin)
}

const LATIN_TO_CYRILLIC: Record<string, string> = {
    a: "а", b: "б", c: "ц", "č": "ч", "ć": "ћ", d: "д", "đ": "ђ", e: "е", "ě": "є", f: "ф", g: "г", h: "х",
    i: "и", j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", "š": "ш", t: "т",
    u: "у", v: "в", y: "ы", z: "з", "ž": "ж",
}

function latinToCyrillicWord(latin: string, digraphs: { dz: string; lj: string; nj: string }): string | null {
    let out = ""
    const lower = latin.toLowerCase()
    for (let i = 0; i < lower.length; i++) {
        const pair = lower.slice(i, i + 2)
        let piece: string | undefined
        if (pair === "dž") piece = digraphs.dz
        else if (pair === "lj") piece = digraphs.lj
        else if (pair === "nj") piece = digraphs.nj
        if (piece !== undefined) i++
        else piece = LATIN_TO_CYRILLIC[lower[i]]
        if (piece === undefined) return null
        // Заглавная сохраняется только в начале слова (имена собственные).
        out += i <= 1 && latin[0] !== lower[0] && out === "" ? piece[0].toUpperCase() + piece.slice(1) : piece
    }
    return out
}

const CYRILLIC_VARIANTS: [RegExp, string][] = [
    [/є/g, "е"], [/Є/g, "Е"],
    [/ы/g, "и"], [/Ы/g, "И"],
]

export function cyrillicSpellings(etym: string): string[] {
    const cleaned = stripStress(etym)
    const sources = [toStandardLatin(cleaned), mapChars(resolveSoft(cleaned), ETYM_TO_STANDARD, new Set(["ć", "Ć", "đ", "Đ"]))]
    const out: string[] = []
    for (const src of sources) {
        // Стандарт - дж/љ/њ; џ и лј/нј тоже встречаются и принимаются.
        for (const digraphs of [{ dz: "дж", lj: "љ", nj: "њ" }, { dz: "џ", lj: "лј", nj: "нј" }]) {
            const cyr = latinToCyrillicWord(src, digraphs)
            if (cyr) out.push(...expand(cyr, CYRILLIC_VARIANTS))
        }
    }
    return [...new Set(out)]
}

const PLAIN_LATIN = /^[a-zA-ZčćđěšžČĆĐĚŠŽ]+(?:-[a-zA-ZčćđěšžČĆĐĚŠŽ]+)*$/

/** После перевода в стандарт в слове остались только буквы стандартного алфавита. */
export function isPlainLatin(word: string): boolean {
    return PLAIN_LATIN.test(word)
}
