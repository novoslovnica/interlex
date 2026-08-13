import { prismaLibrary } from "@/lib/prisma"
import type { Prisma } from "@/prisma/generated/library/client"
import { decompressBody } from "@/lib/body"

export interface PublicLibraryEntry {
    slug: string
    title: string
    author: string | null
    genre: string
    topic: string | null
    summary: string | null
    yearWritten: number | null
    yearTranslated: number | null
    translator: string | null
    source: string | null
    coverImage: string | null
    views: number
    readabilityLevel: string | null
}

export interface PublicLibraryEntryDetail extends PublicLibraryEntry {
    body: string | null
    audioFile: string | null
    videoUrls: string | null
}

// Excludes addedById/addedBy/verifiedBy/actionHistory/parentId (internal
// moderation/authorship-tracking fields with no public value - same
// exclusion principle as PUBLIC_WORD_COLUMNS in ./words.ts) and, on the
// list endpoint specifically, `body` (full text) - mirrors how the existing
// non-API /library page (app/library/page.tsx) already omits body from its
// list select, only fetching it on the detail page.
const LIST_SELECT = {
    slug: true, title: true, author: true, genre: true, topic: true, summary: true,
    yearWritten: true, yearTranslated: true, translator: true, source: true,
    coverImage: true, views: true, readabilityLevel: true,
} satisfies Prisma.LibraryEntrySelect

const DETAIL_SELECT = {
    ...LIST_SELECT,
    body: true, audioFile: true, videoUrls: true,
} satisfies Prisma.LibraryEntrySelect

/**
 * Always filters isPublic: true, regardless of the calling key's owner -
 * unlike app/library/page.tsx, which bypasses this filter for logged-in
 * moderators browsing their own site. An API key represents programmatic
 * access, not a moderation session, so it never sees non-public entries.
 */
export async function searchPublicLibrary(
    search: string,
    limit: number,
    offset: number,
): Promise<{ items: PublicLibraryEntry[]; total: number }> {
    const where: Prisma.LibraryEntryWhereInput = {
        isPublic: true,
        ...(search ? { OR: [{ title: { contains: search } }, { author: { contains: search } }] } : {}),
    }

    const [items, total] = await Promise.all([
        prismaLibrary.libraryEntry.findMany({ where, select: LIST_SELECT, orderBy: { id: "asc" }, take: limit, skip: offset }),
        prismaLibrary.libraryEntry.count({ where }),
    ])

    return { items, total }
}

/**
 * `body` is stored gzip-then-base64 (lib/body.ts's compressBody, written by
 * the admin library editor) - returning it as-is would hand API consumers
 * an opaque blob instead of the text they asked for. decompressBody() falls
 * back to its input unchanged if it isn't valid gzip, so this is safe to
 * call unconditionally - same as the non-API detail page
 * (app/library/[slug]/page.tsx) already does.
 */
export async function getPublicLibraryEntryBySlug(slug: string): Promise<PublicLibraryEntryDetail | null> {
    const entry = await prismaLibrary.libraryEntry.findFirst({ where: { slug, isPublic: true }, select: DETAIL_SELECT })
    if (!entry) return null

    return {
        ...entry,
        body: entry.body ? decompressBody(entry.body) : null,
    }
}
