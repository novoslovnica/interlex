// Чистая сборка RSS 2.0-фида (roadmap п.64) — без БД и Next-зависимостей,
// чтобы было покрываемо юнит-тестами. CDATA не используем: весь текст
// проходит через escapeXml. Лента англоязычная (RSS — для внешних читателей).
export interface FeedItem {
    title: string
    description?: string | null
    link: string
    pubDate: Date
    guid: string
}

const FEED_TITLE = "Interslavic Lexicon — new words and texts"
const FEED_DESCRIPTION = "New Interslavic words and library texts from interslavic-lexicon.com"
const FEED_LANGUAGE = "en"

function escapeXml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function tag(name: string, value: string): string {
    return `<${name}>${escapeXml(value)}</${name}>`
}

// RFC-822 дата (RSS 2.0 §date formats): toUTCString даёт "Sun, 12 Oct 2026 08:00:00 GMT".
function rfc822(d: Date): string {
    return d.toUTCString()
}

export function buildRssFeed(items: FeedItem[], baseUrl: string): string {
    const link = `${baseUrl}/rss.xml`
    const lastBuildDate = items.length > 0
        ? items.reduce((a, b) => (a.pubDate >= b.pubDate ? a : b)).pubDate
        : new Date()

    const itemXml = items
        .map((item) => {
            const parts = [
                tag("title", item.title),
                ...(item.description ? [tag("description", item.description)] : []),
                tag("link", item.link),
                tag("guid", item.guid),
                `<pubDate>${rfc822(item.pubDate)}</pubDate>`,
            ]
            return `    <item>\n      ${parts.join("\n      ")}\n    </item>`
        })
        .join("\n")

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    ${tag("title", FEED_TITLE)}
    ${tag("link", link)}
    ${tag("description", FEED_DESCRIPTION)}
    ${tag("language", FEED_LANGUAGE)}
    <lastBuildDate>${rfc822(lastBuildDate)}</lastBuildDate>
    <pubDate>${rfc822(lastBuildDate)}</pubDate>
${itemXml}
  </channel>
</rss>
`
}
