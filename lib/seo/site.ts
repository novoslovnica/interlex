// Канонический адрес сайта для sitemap/robots - тот же источник, что и
// metadataBase в app/layout.tsx.
export function siteUrl(): string {
    return (process.env.NEXTAUTH_URL || "https://interslavic-lexicon.com").replace(/\/+$/, "")
}
