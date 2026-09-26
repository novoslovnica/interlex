// Загрузка шрифтов для next/og (satori). Satori рисует текст только из
// переданных ему font-буферов — системные шрифты недоступны, поэтому Noto Sans
// с кириллицей фетчим из сети и кэшируем в module scope на всю жизнь процесса.
//
// Деградация при недоступной сети: частично загруженные веса остаются (карточка
// рендерится без пропавшего стиля), при полном провале вернётся пустой массив —
// тогда вызывающий код НЕ передаёт кириллические строки в карточку (satori без
// кириллического шрифта рисует пропуски вместо букв, см. wordOgCard.tsx).

export interface OgFont {
    name: string
    data: ArrayBuffer
    weight: 400 | 700
    style: "normal" | "italic"
}

interface FontSpec {
    weight: 400 | 700
    style: "normal" | "italic"
    subset: "latin" | "cyrillic"
}

const FONT_NAME = "Noto Sans"

// Старый Safari (до woff2) — Google Fonts css2 API отдаёт ему TTF.
const TTF_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.30 (KHTML, like Gecko) Version/5.1 Safari/534.30"

const SPECS: FontSpec[] = [
    { weight: 400, style: "normal", subset: "latin" },
    { weight: 400, style: "normal", subset: "cyrillic" },
    { weight: 700, style: "normal", subset: "latin" },
    { weight: 700, style: "normal", subset: "cyrillic" },
    { weight: 400, style: "italic", subset: "latin" },
    { weight: 400, style: "italic", subset: "cyrillic" },
]

let fontsPromise: Promise<OgFont[]> | null = null

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url}: ${res.status}`)
    return res.arrayBuffer()
}

// Парсим css2-ответ: блоки `@font-face` с комментарием-подмножеством
// (`/* cyrillic */ @font-face { ... font-weight: 400; ... src: url(...) }`).
async function fetchFromGoogleCss(specs: FontSpec[]): Promise<OgFont[]> {
    const css = await (
        await fetch(
            `https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400;0,700;1,400&display=swap`,
            { headers: { "User-Agent": TTF_USER_AGENT } },
        )
    ).text()
    const blocks = css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g)
    const wanted = new Map<string, FontSpec>(
        specs.map((s) => [`${s.subset}|${s.style}|${s.weight}`, s] as const),
    )
    const out: OgFont[] = []
    for (const m of blocks) {
        const subset = m[1]
        const body = m[2]
        const style = /font-style:\s*italic/.test(body) ? "italic" : "normal"
        const weight = /font-weight:\s*(\d+)/.exec(body)?.[1]
        const url = /src:\s*url\((https:[^)]+)\)/.exec(body)?.[1]
        if (!weight || !url) continue
        const spec = wanted.get(`${subset}|${style}|${weight}`)
        if (!spec) continue
        out.push({ name: FONT_NAME, data: await fetchBuffer(url), weight: spec.weight, style: spec.style })
        if (out.length === specs.length) break
    }
    if (out.length !== specs.length) throw new Error(`google css: ${out.length}/${specs.length} faces`)
    return out
}

// Резервный источник — fontsource на jsdelivr (woff; satori его понимает).
async function fetchFromFontsource(specs: FontSpec[]): Promise<OgFont[]> {
    const out: OgFont[] = []
    for (const s of specs) {
        const style = s.style === "italic" ? "italic" : "normal"
        const url = `https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5/files/noto-sans-${s.subset}-${s.weight}-${style}.woff`
        out.push({ name: FONT_NAME, data: await fetchBuffer(url), weight: s.weight, style: s.style })
    }
    return out
}

async function load(): Promise<OgFont[]> {
    try {
        return await fetchFromGoogleCss(SPECS)
    } catch {
        try {
            return await fetchFromFontsource(SPECS)
        } catch {
            // Полный провал сети — без font-буферов satori не рендерит текст вообще;
            // OG-эндпоинтам нужен исходящий доступ к fonts.gstatic.com / cdn.jsdelivr.net.
            return []
        }
    }
}

export function loadOgFonts(): Promise<OgFont[]> {
    fontsPromise ??= load()
    return fontsPromise
}
