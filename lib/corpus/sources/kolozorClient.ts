import { htmlToPlainText } from "./htmlText"
import { fetchWithRetry } from "./fetchWithRetry"

const USER_AGENT = "InterlexCorpusCrawler/1.0 (https://interslavic-lexicon.com; contact: georgecarpow@gmail.com)"
const API_BASE = "https://kolozor.com/wp-json/wp/v2/posts"

export interface KolozorArticle {
    id: number
    title: string
    text: string
    url: string
    /** unix-время последнего изменения — используется как псевдо-revision */
    modifiedAt: number
}

interface WpPost {
    id: number
    link: string
    modified_gmt: string
    title: { rendered: string }
    content: { rendered: string }
}

/**
 * Kolozor — двуязычный WordPress (WPML): посты на корневом домене — кириллица,
 * посты с /en/ в постоянной ссылке — та же публикация на латинице. Плагин не
 * поддерживает фильтрацию REST-запроса по ?lang=en (проверено эмпирически —
 * параметр игнорируется), поэтому забираем все посты одним проходом и
 * фильтруем по наличию "/en/" в link. Пользователь явно просил латиницу.
 */
export async function* listKolozorLatinArticles(): AsyncGenerator<KolozorArticle> {
    let page = 1
    for (;;) {
        const res = await fetchWithRetry(`${API_BASE}?per_page=100&page=${page}&orderby=id&order=asc`, {
            headers: { "User-Agent": USER_AGENT },
        })
        if (res.status === 400) break // за последней страницей WP отдаёт rest_post_invalid_page_number
        if (!res.ok) throw new Error(`kolozor.com API request failed: ${res.status} ${res.statusText}`)

        const posts = (await res.json()) as WpPost[]
        if (posts.length === 0) break

        for (const post of posts) {
            let linkUrl: URL
            try {
                linkUrl = new URL(post.link)
            } catch {
                continue
            }
            const isLatin = linkUrl.pathname.startsWith("/en/")
            if (!isLatin) continue

            const title = htmlToPlainText(post.title.rendered).trim()
            const text = htmlToPlainText(post.content.rendered).trim()
            if (!title || !text) continue

            yield {
                id: post.id,
                title,
                text,
                url: post.link,
                modifiedAt: Math.floor(new Date(post.modified_gmt + "Z").getTime() / 1000),
            }
        }

        const totalPagesHeader = res.headers.get("x-wp-totalpages")
        const totalPages = totalPagesHeader ? Number(totalPagesHeader) : page
        if (page >= totalPages) break
        page++
    }
}
