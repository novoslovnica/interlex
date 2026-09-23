// Сжатие полного списка словоформ в пару Hunspell .dic/.aff.
//
// У каждой лексемы берётся основа - общий префикс всех её написаний, - и
// набор окончаний-остатков. Одинаковые наборы (а у лексем одного типа
// склонения они одинаковы) становятся одним классом SFX с числовым флагом.
// Правила самые простые, какие понимает любой Hunspell-совместимый движок
// (LibreOffice, Firefox, nspell): без условий и без отрезания (strip 0).
// Если основа не является словом сама по себе, запись получает флаг
// NEEDAFFIX. Сжатие без потерь - это проверяет expandHunspell в тестах.

export const NEEDAFFIX_FLAG = 1
const MIN_STEM = 2

export interface HunspellOptions {
    /** Пары MAP: родственные буквы для подсказок, первая - стандартная. */
    map: string[]
    /** Пары REP: частые путаницы "что написано -> что имелось в виду". */
    rep: [string, string][]
    /** Символы, которые считаются частью слова помимо букв. */
    wordChars: string
    /** Комментарий в начале .aff (версия, дата, источник). */
    header: string[]
}

export interface HunspellDictionary {
    aff: string
    dic: string
    stats: { words: number; entries: number; classes: number }
}

function commonPrefix(words: string[]): string {
    let prefix = words[0]
    for (const w of words) {
        let i = 0
        while (i < prefix.length && i < w.length && prefix[i] === w[i]) i++
        prefix = prefix.slice(0, i)
        if (!prefix) break
    }
    // Не резать посреди буквы из двух кодовых точек (на всякий случай - формы в NFC).
    return prefix
}

function letterFrequency(words: Iterable<string>): string {
    const counts = new Map<string, number>()
    for (const w of words) for (const ch of w.toLowerCase()) if (/\p{L}/u.test(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([ch]) => ch).join("")
}

/** lexemes: для каждой лексемы - множество её написаний (все формы, все принятые варианты). */
export function buildHunspell(lexemes: Iterable<Iterable<string>>, options: HunspellOptions): HunspellDictionary {
    const classes = new Map<string, { flag: number; suffixes: string[] }>()
    const entries = new Set<string>()
    const allWords = new Set<string>()
    let nextFlag = NEEDAFFIX_FLAG + 1

    for (const forms of lexemes) {
        const words = [...new Set(forms)].filter((w) => w.length > 0 && !/[\s/]/.test(w)).sort()
        if (words.length === 0) continue
        for (const w of words) allWords.add(w)
        const stem = commonPrefix(words)
        if (words.length === 1 || stem.length < MIN_STEM) {
            for (const w of words) entries.add(w)
            continue
        }
        const suffixes = words.map((w) => w.slice(stem.length)).filter((s) => s !== "")
        const stemIsWord = suffixes.length < words.length
        const key = suffixes.join("|")
        let cls = classes.get(key)
        if (!cls) {
            cls = { flag: nextFlag++, suffixes }
            classes.set(key, cls)
        }
        entries.add(`${stem}/${stemIsWord ? cls.flag : `${NEEDAFFIX_FLAG},${cls.flag}`}`)
    }

    const aff: string[] = [
        ...options.header.map((l) => `# ${l}`),
        "SET UTF-8",
        "FLAG num",
        `NEEDAFFIX ${NEEDAFFIX_FLAG}`,
        `TRY ${letterFrequency(allWords)}`,
        ...(options.wordChars ? [`WORDCHARS ${options.wordChars}`] : []),
        "",
        `MAP ${options.map.length}`,
        ...options.map.map((m) => `MAP ${m}`),
        "",
        `REP ${options.rep.length}`,
        ...options.rep.map(([from, to]) => `REP ${from} ${to}`),
        "",
    ]
    for (const { flag, suffixes } of classes.values()) {
        aff.push(`SFX ${flag} N ${suffixes.length}`)
        for (const s of suffixes) aff.push(`SFX ${flag} 0 ${s} .`)
    }

    const sortedEntries = [...entries].sort()
    return {
        aff: aff.join("\n") + "\n",
        dic: `${sortedEntries.length}\n${sortedEntries.join("\n")}\n`,
        stats: { words: allWords.size, entries: sortedEntries.length, classes: classes.size },
    }
}

/**
 * Разворачивает .dic/.aff, построенные buildHunspell, обратно в множество слов.
 * Понимает только своё подмножество формата (SFX без условий и strip,
 * NEEDAFFIX, FLAG num) - для тестов и для проверки выгрузки.
 */
export function expandHunspell(aff: string, dic: string): Set<string> {
    const suffixes = new Map<number, string[]>()
    let needAffix = -1
    for (const line of aff.split("\n")) {
        const parts = line.trim().split(/\s+/)
        if (parts[0] === "NEEDAFFIX") needAffix = Number(parts[1])
        if (parts[0] === "SFX" && parts.length === 5) {
            const flag = Number(parts[1])
            const list = suffixes.get(flag) ?? []
            list.push(parts[3] === "0" ? "" : parts[3])
            suffixes.set(flag, list)
        }
    }
    const words = new Set<string>()
    for (const line of dic.split("\n").slice(1)) {
        if (!line) continue
        const slash = line.indexOf("/")
        const stem = slash === -1 ? line : line.slice(0, slash)
        const flags = slash === -1 ? [] : line.slice(slash + 1).split(",").map(Number)
        if (!flags.includes(needAffix)) words.add(stem)
        for (const f of flags) for (const s of suffixes.get(f) ?? []) words.add(stem + s)
    }
    return words
}
