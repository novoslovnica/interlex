import type { MetadataRoute } from "next"
import { generateSitemaps } from "./sitemap"
import { siteUrl } from "@/lib/seo/site"

export const revalidate = 86400

export default async function robots(): Promise<MetadataRoute.Robots> {
    const base = siteUrl()
    const sitemaps = await generateSitemaps()
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // /api/ со слэшем: /api-docs индексировать можно.
            disallow: ["/admin", "/api/", "/settings", "/profile", "/login", "/unauthorized", "/flashcards"],
        },
        sitemap: sitemaps.map((s) => `${base}/sitemap/${s.id}.xml`),
    }
}
