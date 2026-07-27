import { repairMojibakeUtf8 } from "./mojibake"
import { htmlToPlainText, filterLatinParagraphs } from "./htmlText"
import { fetchWithRetry } from "./fetchWithRetry"

const USER_AGENT = "InterlexCorpusCrawler/1.0 (https://interslavic-lexicon.com; contact: georgecarpow@gmail.com)"
const BASE = "https://interslavic.news/izvesti.info"

// SEF-роутинг (человекочитаемые /kategorija/NNN-slug URL) на этом переносе
// сайта сломан (404) — прямой некрасивый Joomla-роут index.php?option=
// com_content&view=article&id=N работает и отдаёт тот же <article
// class="item-page">. Максимальный известный id (по RSS-ленте) — 334, id 340+
// уже 404. Берём небольшой запас.
export const MAX_ARTICLE_ID_SCAN = 360

export interface IzvestiArticle {
    id: number
    title: string
    text: string
    url: string
}

async function fetchDecoded(url: string): Promise<{ status: number; body: string }> {
    const res = await fetchWithRetry(url, { headers: { "User-Agent": USER_AGENT } })
    const buffer = Buffer.from(await res.arrayBuffer())
    return { status: res.status, body: repairMojibakeUtf8(buffer) }
}

export async function fetchIzvestiArticle(id: number): Promise<IzvestiArticle | null> {
    const url = `${BASE}/index.php?option=com_content&view=article&id=${id}`
    const { status, body } = await fetchDecoded(url)
    if (status === 404) return null

    const articleStart = body.indexOf('class="item-page"')
    if (articleStart === -1) return null

    const titleMatch = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(body.slice(articleStart))
    if (!titleMatch) return null
    const title = htmlToPlainText(titleMatch[1]).trim()
    if (!title) return null

    const infoEnd = body.indexOf("</dl>", articleStart)
    const articleEnd = body.indexOf("</article>", articleStart)
    if (infoEnd === -1 || articleEnd === -1 || articleEnd <= infoEnd) return null

    const bodyHtml = body.slice(infoEnd + "</dl>".length, articleEnd)
    const text = filterLatinParagraphs(htmlToPlainText(bodyHtml))
    if (!text) return null

    return { id, title, text, url }
}

const FETCH_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function* listIzvestiArticles(): AsyncGenerator<IzvestiArticle> {
    for (let id = 1; id <= MAX_ARTICLE_ID_SCAN; id++) {
        if (id > 1) await sleep(FETCH_DELAY_MS)
        const article = await fetchIzvestiArticle(id)
        if (article) yield article
    }
}
