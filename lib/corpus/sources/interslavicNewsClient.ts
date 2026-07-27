import { repairMojibakeUtf8 } from "./mojibake"
import { htmlToPlainText, filterLatinParagraphs } from "./htmlText"
import { fetchWithRetry } from "./fetchWithRetry"

const USER_AGENT = "InterlexCorpusCrawler/1.0 (https://interslavic-lexicon.com; contact: georgecarpow@gmail.com)"

// Сайт отдаёт статьи по числовому id (https://interslavic.news/{id}), независимо
// от категории (k) — подтверждено эмпирически (index?k=5&clanok=132 рендерит ту
// же статью, что и index?k=0&clanok=132). На момент разведки максимальный
// известный id — 145 при "vsih člankov jest 73" (т.е. id не идут подряд).
// Берём запас на будущий рост числа статей.
export const MAX_ARTICLE_ID_SCAN = 250

export interface NewsArticle {
    id: number
    title: string
    text: string
    url: string
}

async function fetchDecoded(url: string): Promise<string> {
    const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } })
    if (!res.ok) throw new Error(`interslavic.news request failed: ${res.status} ${res.statusText}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    return repairMojibakeUtf8(buffer)
}

/**
 * Возвращает статью по id или null, если такой статьи нет — невалидный id
 * отдаёт HTTP 200 с пустой #rightpane (без <h1>), а не 404.
 */
export async function fetchNewsArticle(id: number): Promise<NewsArticle | null> {
    const url = `https://interslavic.news/${id}`
    const html = await fetchDecoded(url)

    const rightpaneStart = html.indexOf('id="rightpane"')
    if (rightpaneStart === -1) return null

    const titleMatch = /<h1>([\s\S]*?)<\/h1>/.exec(html.slice(rightpaneStart))
    if (!titleMatch) return null
    const title = htmlToPlainText(titleMatch[1]).trim()
    if (!title) return null

    const smallEnd = html.indexOf("</small>", rightpaneStart)
    const footerStart = html.indexOf('id="footer"', rightpaneStart)
    if (smallEnd === -1 || footerStart === -1 || footerStart <= smallEnd) return null

    const bodyHtml = html.slice(smallEnd + "</small>".length, footerStart)
    const text = filterLatinParagraphs(htmlToPlainText(bodyHtml))
    if (!text) return null

    return { id, title, text, url }
}

const FETCH_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Пауза применяется к каждой попытке (валидный id или нет) — большинство id в
 * диапазоне не соответствуют реальной статье, и без паузы именно здесь сайт
 * получил бы всплеск запросов без задержек.
 */
export async function* listNewsArticles(): AsyncGenerator<NewsArticle> {
    for (let id = 1; id <= MAX_ARTICLE_ID_SCAN; id++) {
        if (id > 1) await sleep(FETCH_DELAY_MS)
        const article = await fetchNewsArticle(id)
        if (article) yield article
    }
}
