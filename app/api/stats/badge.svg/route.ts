import { getMainStats } from "@/app/main/stats"

export const runtime = "nodejs"

type Plurals = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

const captions: Record<"en" | "ru" | "isv", { words: Plurals; tokens: Plurals; locale: string }> = {
    en: { words: { one: "word", other: "words" }, tokens: { one: "corpus token", other: "corpus tokens" }, locale: "en" },
    ru: { words: { one: "слово", few: "слова", other: "слов" }, tokens: { one: "токен корпуса", few: "токена корпуса", other: "токенов корпуса" }, locale: "ru" },
    isv: { words: { one: "slovo", few: "slova", other: "slov" }, tokens: { one: "token korpusa", few: "tokeny korpusa", other: "tokenov korpusa" }, locale: "ru" },
}

export async function GET(request: Request) {
    const lang = new URL(request.url).searchParams.get("lang")
    const caption = captions[lang === "ru" || lang === "isv" ? lang : "en"]
    const { words, totalTokens } = await getMainStats()
    const format = new Intl.NumberFormat(caption.locale)
    const plural = new Intl.PluralRules(caption.locale)
    const label = (count: number, forms: Plurals) => `${format.format(count)} ${forms[plural.select(count)] ?? forms.other}`
    const dictionary = label(words, caption.words)
    const corpus = label(totalTokens, caption.tokens)

    // Labels are selected from static strings. The only interpolated data
    // from the databases are formatted numeric counts.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="386" height="36" viewBox="0 0 386 36" role="img" aria-labelledby="title">
  <title id="title">Interlex · ${dictionary} · ${corpus}</title>
  <rect width="386" height="36" rx="8" fill="#172554"/>
  <rect x="8" y="6" width="68" height="24" rx="5" fill="#1d4ed8"/>
  <path d="M199 9v18" stroke="#93c5fd" opacity=".6"/>
  <g fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12">
    <text x="42" y="22" font-weight="700">Interlex</text>
    <text x="137" y="22">${dictionary}</text>
    <text x="290" y="22">${corpus}</text>
  </g>
</svg>`
    return new Response(svg, {
        headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=300",
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    })
}
