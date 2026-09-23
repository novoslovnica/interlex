import { TRANSLATION_LANGUAGES } from "@/config/features"
import { siteUrl } from "@/lib/seo/site"
import { buildAdjectiveColumns, buildNounParadigm, buildVerbParadigm, NOUN_CASES, type ParadigmSource } from "@/lib/paradigm"
import { GrammaticalGender } from "@/lib/grammar/common/gender"
import { NumberType } from "@/lib/grammar/endingsRegistry"
import { latinToCyrillic, toStandardLatin } from "@/lib/orthography/standard"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import type { LookupEntry, LookupResult } from "./lookup"
import type { BotMessage } from "./message"
import { t, type BotLocale } from "./labels"

export type Script = "lat" | "cyr"

const FLAGS = new Map<string, string>(TRANSLATION_LANGUAGES.map((l) => [l.code, l.flag]))

/** Форма для показа: без знаков ударения (в моноширинной таблице они сбивают колонки), в письменности пользователя. */
export function display(form: string, script: Script): string {
    const standard = toStandardLatin(form)
    return script === "cyr" ? latinToCyrillic(standard) : standard
}

function wordUrl(id: number): string {
    return `${siteUrl()}/words/${id}`
}

function entrySubtitle(e: LookupEntry): string {
    return [e.pos?.toLowerCase(), e.gender?.toLowerCase(), e.aspect?.toLowerCase()].filter(Boolean).join(", ")
}

function translationLines(e: LookupEntry): string[] {
    return e.translations.map((tr) => `${FLAGS.get(tr.language) || tr.language}  ${tr.values.join(", ")}`)
}

export function entryMessage(e: LookupEntry, locale: BotLocale, script: Script): BotMessage {
    const lines = translationLines(e)
    if (e.meanings[0]) lines.push("", `📖 ${e.meanings[0]}`)
    if (e.example) lines.push(`💬 ${e.example}`)
    return {
        title: display(e.value, script),
        subtitle: entrySubtitle(e),
        lines,
        link: { label: t(locale).openOnSite, url: wordUrl(e.id) },
    }
}

export function lookupMessage(result: LookupResult, locale: BotLocale, script: Script): BotMessage {
    const L = t(locale)
    const bullet = (e: LookupEntry) => `• ${display(e.value, script)} — ${e.translations[0]?.values.slice(0, 3).join(", ") ?? ""}`
    const [first, ...rest] = result.entries
    if (!first) return { title: result.query, lines: [L.notFound(result.query)] }
    if (result.via === "fuzzy") {
        return { title: result.query, lines: [L.notFound(result.query), "", L.similar, ...result.entries.map(bullet)] }
    }
    const msg = entryMessage(first, locale, script)
    // Упрощённое написание самой леммы ("clovek") - не "форма слова".
    if (result.via === "form" && foldDiacritics(result.latinQuery.toLowerCase()) !== foldDiacritics(first.value.toLowerCase())) {
        const readings = result.formReadings?.length ? ` (${result.formReadings.join("; ")})` : ""
        msg.subtitle = [msg.subtitle, `${L.formOf}: ${result.query}${readings}`].filter(Boolean).join(" · ")
    }
    // Омонимы и другие лексемы с той же формой.
    if (rest.length) msg.lines.push("", L.also, ...rest.map(bullet))
    return msg
}

/** Таблица форм: существительное (ед./мн.), глагол (настоящее, l-причастие, повелительное), прилагательное (м./ж./ср.). */
export function paradigmMessage(src: ParadigmSource & { id: number }, knownPrepositions: string[], locale: BotLocale, script: Script): BotMessage {
    const L = t(locale)
    const base: BotMessage = { title: display(src.value, script), subtitle: src.pos?.toLowerCase() ?? undefined, lines: [], link: { label: L.openOnSite, url: wordUrl(src.id) } }
    const d = (f: string | undefined) => (f ? display(f, script) : "—")

    const noun = buildNounParadigm(src)
    if (noun) {
        return { ...base, table: [["", L.sg, L.pl], ...NOUN_CASES.map((c) => [L.cases[c], d(noun.singular[c]), d(noun.plural[c])])] }
    }
    const verb = buildVerbParadigm(src, knownPrepositions)
    if (verb) {
        const p = verb.indicative.presentOrFutureDirect
        const persons = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"] as const
        const l = verb.lParticiple
        return {
            ...base,
            lines: [`${L.infinitive}: ${d(verb.infinitive)}`, `${L.past}: ${[l.masculine, l.feminine, l.neuter, l.plural_masculine].map(d).join(", ")}`, `${L.imperative}: ${[verb.imperative["2sg"], verb.imperative["1pl"], verb.imperative["2pl"]].map(d).join(", ")}`],
            table: [["", L.present], ...persons.map((per) => [per, d(p[per])])],
        }
    }
    if (src.pos === "ADJ") {
        const genders = [GrammaticalGender.MASC, GrammaticalGender.FEM, GrammaticalGender.NEUT]
        const cols = genders.map((g) => buildAdjectiveColumns(src, g, "pos")[NumberType.SINGULAR])
        return { ...base, table: [["", L.masc, L.fem, L.neut], ...NOUN_CASES.map((c) => [L.cases[c], ...cols.map((col) => d(col[c]))])] }
    }
    return { ...base, lines: [L.noParadigm] }
}

export function wordOfDayMessage(e: LookupEntry, locale: BotLocale, script: Script): BotMessage {
    const msg = entryMessage(e, locale, script)
    return { ...msg, title: `${t(locale).wordOfDay}: ${msg.title}` }
}
