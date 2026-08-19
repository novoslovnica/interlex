import * as cheerio from "cheerio"
import { fetchWithRetry } from "@/lib/corpus/sources/fetchWithRetry"

const USER_AGENT = "InterlexCorpusCrawler/1.0 (https://interslavic-lexicon.com; contact: georgecarpow@gmail.com)"

export interface ScrapedMeta {
    title: string | null
    description: string | null
    thumbnailUrl: string | null
}

/**
 * Читает og:title/og:description/og:image (с фолбэком на name="description")
 * из статического HTML страницы. YouTube-каналы и Spotify-шоу отдают эти теги
 * в исходном HTML без JS-рендеринга — проверено эмпирически на реальных URL,
 * API-ключ не нужен. Ничего не пишет в БД — чистая функция, только сеть.
 */
export async function scrapePageMeta(url: string): Promise<ScrapedMeta> {
    const res = await fetchWithRetry(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    })
    if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`)

    const html = await res.text()
    const $ = cheerio.load(html)

    const title = $('meta[property="og:title"]').attr("content")?.trim() || null
    const description =
        $('meta[property="og:description"]').attr("content")?.trim() ||
        $('meta[name="description"]').attr("content")?.trim() ||
        null
    // data: URI "превьюшки" (напр. сгенерированный Telegram-аватар без фото)
    // не настоящее изображение источника — не сохраняем, раздувает поле в БД.
    const rawThumbnail = $('meta[property="og:image"]').attr("content")?.trim() || null
    const thumbnailUrl = rawThumbnail && !rawThumbnail.startsWith("data:") ? rawThumbnail : null

    return { title, description, thumbnailUrl }
}
