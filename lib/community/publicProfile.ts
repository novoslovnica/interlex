import { prismaAuth } from "@/lib/prisma"
import { normalizeHandle } from "./handle"

// Публичная сторона профиля: только то, что участник сам сделал публичным
// (ник, "о себе", языки). name/email из User не читаются - см. identity.ts.
export interface PublicProfile {
    userId: string
    handle: string
    bio: string | null
    createdAt: Date
    languages: string[]
}

export async function fetchPublicProfile(rawHandle: string): Promise<PublicProfile | null> {
    const profile = await prismaAuth.userProfile.findUnique({
        where: { handle: normalizeHandle(rawHandle) },
        select: { userId: true, handle: true, bio: true, createdAt: true, user: { select: { languages: { select: { language: true } } } } },
    })
    if (!profile) return null
    return { userId: profile.userId, handle: profile.handle, bio: profile.bio, createdAt: profile.createdAt, languages: profile.user.languages.map((l) => l.language) }
}
