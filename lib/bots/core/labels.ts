// Тексты ботов. Язык - из настроек платформы (language_code Telegram, locale
// Discord), сведённый к одному из трёх языков интерфейса сайта.

export type BotLocale = "ru" | "en" | "isv"

export function toBotLocale(code: string | null | undefined): BotLocale {
    const c = (code ?? "").toLowerCase().slice(0, 2)
    if (c === "ru" || c === "uk" || c === "be") return "ru"
    return "en"
}

/** Языки переводов в ответе: язык пользователя (если он есть в словаре) и английский. */
export function translationLanguages(code: string | null | undefined, available: readonly string[]): string[] {
    const c = (code ?? "").toLowerCase().split(/[-_]/)[0]
    const out = available.includes(c) && c !== "en" ? [c, "en"] : ["en", "ru"]
    return out
}

const TEXT = {
    ru: {
        notFound: (q: string) => `Слово «${q}» не найдено в лексиконе.`,
        similar: "Похожие слова:",
        also: "Также:",
        formOf: "форма слова",
        openOnSite: "Открыть в лексиконе",
        noParadigm: "Для этого слова таблица форм есть только на сайте.",
        wordOfDay: "Слово дня",
        help: "Пришлите слово на межславянском или на одном из славянских языков — я найду его в лексиконе.\n\n/forms слово — все формы (склонение, спряжение)\n/cyr текст — латиница → кириллица\n/lat текст — кириллица → латиница\n/today — слово дня\n\nВ любом чате: @{bot} слово",
        usage: (cmd: string) => `Напишите слово после команды: /${cmd} voda`,
        tooMany: "Слишком много запросов, подождите минуту.",
        cases: { nom: "Им.", gen: "Род.", dat: "Дат.", acc: "Вин.", ins: "Твор.", loc: "Мест.", voc: "Зват." } as Record<string, string>,
        sg: "ед.", pl: "мн.", masc: "м.", fem: "ж.", neut: "ср.",
        present: "Настоящее", past: "Прошедшее (l-причастие)", imperative: "Повелительное", infinitive: "Инфинитив",
    },
    en: {
        notFound: (q: string) => `“${q}” is not in the lexicon.`,
        similar: "Similar words:",
        also: "Also:",
        formOf: "form of",
        openOnSite: "Open in the lexicon",
        noParadigm: "The table of forms for this word is only on the website.",
        wordOfDay: "Word of the day",
        help: "Send me a word in Interslavic or in a Slavic language and I will find it in the lexicon.\n\n/forms word — all forms (declension, conjugation)\n/cyr text — Latin → Cyrillic\n/lat text — Cyrillic → Latin\n/today — word of the day\n\nIn any chat: @{bot} word",
        usage: (cmd: string) => `Add a word after the command: /${cmd} voda`,
        tooMany: "Too many requests, please wait a minute.",
        cases: { nom: "Nom", gen: "Gen", dat: "Dat", acc: "Acc", ins: "Ins", loc: "Loc", voc: "Voc" } as Record<string, string>,
        sg: "sg", pl: "pl", masc: "m", fem: "f", neut: "n",
        present: "Present", past: "Past (l-participle)", imperative: "Imperative", infinitive: "Infinitive",
    },
    isv: {
        notFound: (q: string) => `Slovo «${q}» ne jest najdeno v leksikonu.`,
        similar: "Podobne slova:",
        also: "Takože:",
        formOf: "forma slova",
        openOnSite: "Otvoriti v leksikonu",
        noParadigm: "Tablica form za to slovo jest jedino na sajtu.",
        wordOfDay: "Slovo dnja",
        help: "Pošlite slovo na medžuslovjanskom ili na jednom slovjanskom jezyku — najdu jego v leksikonu.\n\n/forms slovo — vse formy\n/cyr tekst — latinica → kirilica\n/lat tekst — kirilica → latinica\n/today — slovo dnja\n\nV vsakom čatu: @{bot} slovo",
        usage: (cmd: string) => `Napišite slovo po komandě: /${cmd} voda`,
        tooMany: "Prěmnogo zaprosov, počakajte minutu.",
        cases: { nom: "Nom.", gen: "Gen.", dat: "Dat.", acc: "Akuz.", ins: "Instr.", loc: "Lok.", voc: "Vok." } as Record<string, string>,
        sg: "jed.", pl: "mn.", masc: "m.", fem: "ž.", neut: "sr.",
        present: "Sęčasno", past: "Minulo (l-participij)", imperative: "Imperativ", infinitive: "Infinitiv",
    },
}

export function t(locale: BotLocale) {
    return TEXT[locale]
}
