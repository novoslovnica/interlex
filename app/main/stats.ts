import {unstable_cache} from "next/cache"
import {prismaData, prismaCorpus} from "@/lib/prisma"

export interface MainStats {
    words: number
    meanings: number
    roots: number
    totalTokens: number
    coverage: number
    zipfAlpha: number | null
}

function parseZipfAlpha(value: string | undefined): number | null {
    if (!value?.trim()) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export async function loadMainStats(): Promise<MainStats> {
    // Separate queries: these clients belong to separate databases. No session,
    // cookies or localized labels inside the shared cache.
    const [words, meanings, roots, totalTokens, matchedTokens, zipf] = await Promise.all([
        prismaData.lexeme.count({where: {isPublic: true}}),
        prismaData.meaning.count({where: {lexeme: {isPublic: true}}}),
        prismaData.morpheme.count(),
        prismaCorpus.corpusToken.count(),
        prismaCorpus.corpusToken.count({where: {wordSlug: {not: null}}}),
        // Already maintained by computeLexiconFrequencies. Never GROUP BY the
        // multi-million-token corpus during page rendering, even on a cold cache.
        prismaCorpus.corpusConfig.findUnique({where: {key: "zipf_alpha"}, select: {value: true}}),
    ])
    return {
        words, meanings, roots, totalTokens,
        // Preserve the existing token-link coverage metric; this isn't a POS or
        // disambiguation accuracy score (and includes punctuation in the base).
        coverage: totalTokens > 0 ? matchedTokens / totalTokens * 100 : 0,
        zipfAlpha: parseZipfAlpha(zipf?.value),
    }
}

export const getMainStats = unstable_cache(loadMainStats, ["homepage-public-stats-v2"], {revalidate: 300})
