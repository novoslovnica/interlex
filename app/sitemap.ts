import type { MetadataRoute } from "next"
import { init } from "@/lib/sqlite"
import { prismaLibrary } from "@/lib/prisma"
import { siteUrl } from "@/lib/seo/site"

// Несколько файлов вместо одного: /sitemap/pages.xml, /sitemap/words-0.xml,
// /sitemap/proto-0.xml. Лимит поисковиков - 50 000 адресов на файл; слов
// ~21 тыс., праслав. статей ~24,5 тыс. - в сумме уже близко к лимиту, поэтому
// крупные разделы режутся на части по CHUNK. Все файлы перечислены в robots.txt.
const CHUNK = 40_000

// Пересобирается раз в сутки, а не только при сборке - иначе новые слова
// попадали бы в sitemap лишь со следующим релизом.
export const revalidate = 86400

const STATIC_PATHS: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "daily" },
    { path: "/lexicon", priority: 0.9, changeFrequency: "daily" },
    { path: "/translate", priority: 0.8, changeFrequency: "weekly" },
    { path: "/library", priority: 0.8, changeFrequency: "weekly" },
    { path: "/corpus", priority: 0.7, changeFrequency: "weekly" },
    { path: "/corpus/collocations", priority: 0.5, changeFrequency: "weekly" },
    { path: "/proto", priority: 0.7, changeFrequency: "monthly" },
    { path: "/textbook/ru", priority: 0.7, changeFrequency: "monthly" },
    { path: "/transliteration", priority: 0.6, changeFrequency: "monthly" },
    { path: "/rhyme", priority: 0.5, changeFrequency: "monthly" },
    { path: "/media", priority: 0.5, changeFrequency: "weekly" },
    { path: "/downloads", priority: 0.5, changeFrequency: "monthly" },
    { path: "/contribute", priority: 0.5, changeFrequency: "daily" },
    { path: "/contribute/leaderboard", priority: 0.3, changeFrequency: "daily" },
    { path: "/about", priority: 0.4, changeFrequency: "monthly" },
    { path: "/changelog", priority: 0.3, changeFrequency: "weekly" },
    { path: "/api-docs", priority: 0.3, changeFrequency: "monthly" },
]

async function withDb<T>(fn: (db: Awaited<ReturnType<typeof init>>) => T): Promise<T> {
    const db = await init()
    try { return fn(db) } finally { db.close() }
}

export async function generateSitemaps() {
    const { words, proto } = await withDb((db) => ({
        words: (db.prepare(`SELECT COUNT(*) c FROM lexemes WHERE isPublic = 1`).get() as { c: number }).c,
        proto: (db.prepare(`SELECT COUNT(*) c FROM proto_slavic_words`).get() as { c: number }).c,
    }))
    const chunks = (prefix: string, n: number) => Array.from({ length: Math.max(1, Math.ceil(n / CHUNK)) }, (_, i) => ({ id: `${prefix}-${i}` }))
    return [{ id: "pages" }, ...chunks("words", words), ...chunks("proto", proto)]
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
    const id = await props.id
    const base = siteUrl()

    if (id === "pages") {
        const library = await prismaLibrary.libraryEntry.findMany({
            where: { isPublic: true },
            select: { slug: true, updatedAt: true },
            orderBy: { slug: "asc" },
        })
        return [
            ...STATIC_PATHS.map((p) => ({ url: `${base}${p.path}`, changeFrequency: p.changeFrequency, priority: p.priority })),
            ...library.map((e) => ({ url: `${base}/library/${encodeURIComponent(e.slug)}`, lastModified: e.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
        ]
    }

    const m = /^(words|proto)-(\d+)$/.exec(id)
    if (!m) return []
    const offset = Number(m[2]) * CHUNK
    if (m[1] === "words") {
        // /words/[id] открывается по числовому id лексемы (getItem: WHERE id = ?).
        const rows = await withDb((db) => db.prepare(`
            SELECT id, updatedAt FROM lexemes WHERE isPublic = 1 ORDER BY id LIMIT ? OFFSET ?
        `).all(CHUNK, offset) as { id: number; updatedAt: string | null }[])
        return rows.map((r) => ({
            url: `${base}/words/${r.id}`,
            ...(r.updatedAt ? { lastModified: new Date(r.updatedAt) } : {}),
            changeFrequency: "monthly" as const,
            priority: 0.7,
        }))
    }
    const rows = await withDb((db) => db.prepare(`SELECT id FROM proto_slavic_words ORDER BY id LIMIT ? OFFSET ?`).all(CHUNK, offset) as { id: number }[])
    return rows.map((r) => ({ url: `${base}/proto/${r.id}`, changeFrequency: "yearly" as const, priority: 0.4 }))
}
