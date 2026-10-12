// RSS 2.0-лента новых слов лексикона и текстов библиотеки (roadmap п.64).
// Файл-конвенция App Router: отдаётся как /rss.xml. Пересобирается раз в час,
// чтобы новые слова/тексты попадали в ленту без нового деплоя. Сборка XML —
// чистая функция lib/rss/feed.ts.
import { init } from "@/lib/sqlite"
import { prismaLibrary } from "@/lib/prisma"
import { siteUrl } from "@/lib/seo/site"
import { buildRssFeed, type FeedItem } from "@/lib/rss/feed"

export const revalidate = 3600

const ITEMS_PER_SOURCE = 25
const MAX_ITEMS = 50

interface LexemeRow {
    id: number
    value: string | null
    pos: string | null
    createdAt: string | null
    updatedAt: string | null
    description: string | null
}

async function fetchRecentWords(base: string): Promise<FeedItem[]> {
    const db = await init()
    try {
        // Lexeme.createdAt есть (data.schema.prisma), но на старых строках из
        // ранних импортов он может быть NULL — тогда фолбэк на updatedAt.
        // Описание: первый en-перевод (translations.language='en' через
        // meaningId), фолбэк — текст первого значения (meanings.meaning).
        const rows = db.prepare(`
            SELECT l.id, l.value, l.pos, l.createdAt, l.updatedAt,
                COALESCE(
                    (SELECT t.value FROM translations t
                        JOIN meanings m ON m.id = t.meaningId
                        WHERE m.lexemeId = l.id AND t.language = 'en'
                            AND t.value IS NOT NULL AND t.value != ''
                        ORDER BY t.id LIMIT 1),
                    (SELECT m.meaning FROM meanings m
                        WHERE m.lexemeId = l.id AND m.meaning IS NOT NULL AND m.meaning != ''
                        ORDER BY m.id LIMIT 1)
                ) AS description
            FROM lexemes l
            WHERE l.isPublic = 1
            ORDER BY COALESCE(l.createdAt, l.updatedAt) DESC, l.id DESC
            LIMIT ?
        `).all(ITEMS_PER_SOURCE) as LexemeRow[]
        return rows.flatMap((r) => {
            const dateStr = r.createdAt ?? r.updatedAt
            if (!r.value || !dateStr) return []
            return [{
                title: r.pos ? `${r.value} (${r.pos})` : r.value,
                description: r.description,
                link: `${base}/words/${r.id}`,
                pubDate: new Date(dateStr),
                guid: `${base}/words/${r.id}`,
            }]
        })
    } finally {
        db.close()
    }
}

async function fetchRecentTexts(base: string): Promise<FeedItem[]> {
    const entries = await prismaLibrary.libraryEntry.findMany({
        where: { isPublic: true },
        select: { slug: true, title: true, summary: true, createdAt: true, updatedAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: ITEMS_PER_SOURCE,
    })
    return entries.map((e) => ({
        title: e.title,
        description: e.summary,
        link: `${base}/library/${encodeURIComponent(e.slug)}`,
        pubDate: e.createdAt ?? e.updatedAt,
        guid: `${base}/library/${encodeURIComponent(e.slug)}`,
    }))
}

export async function GET(): Promise<Response> {
    const base = siteUrl()
    const [words, texts] = await Promise.all([fetchRecentWords(base), fetchRecentTexts(base)])
    const items = [...words, ...texts]
        .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
        .slice(0, MAX_ITEMS)
    const xml = buildRssFeed(items, base)
    return new Response(xml, {
        headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    })
}
