import { prismaAuth } from "@/lib/prisma"
import { generateApiKey } from "@/lib/apiKeyCrypto"

// Soft cap against accidental hammering of key creation - not a security
// control, just cheap insurance (self-serve issuance has no admin approval
// step, see AGENTS.md/roadmap "Public API" notes).
const MAX_ACTIVE_KEYS_PER_USER = 20
const MAX_NAME_LENGTH = 60

export interface ApiKeySummary {
    id: string
    name: string
    keyPrefix: string
    lastUsedAt: Date | null
    requestCount: number
    createdAt: Date
    revokedAt: Date | null
}

const SUMMARY_SELECT = {
    id: true,
    name: true,
    keyPrefix: true,
    lastUsedAt: true,
    requestCount: true,
    createdAt: true,
    revokedAt: true,
} as const

/** Never selects keyHash - the raw key is never retrievable again after creation. */
export function listApiKeysForUser(userId: string): Promise<ApiKeySummary[]> {
    return prismaAuth.apiKey.findMany({
        where: { userId },
        select: SUMMARY_SELECT,
        orderBy: { createdAt: "desc" },
    })
}

export interface CreateApiKeyResult extends ApiKeySummary {
    rawKey: string
}

export type CreateApiKeyError = { error: "invalid_name" | "limit_reached" }

/** Returns the raw key exactly once - callers must display-and-warn, it is never shown again. */
export async function createApiKeyForUser(userId: string, name: string): Promise<CreateApiKeyResult | CreateApiKeyError> {
    const trimmedName = name.trim()
    if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
        return { error: "invalid_name" }
    }

    const activeCount = await prismaAuth.apiKey.count({ where: { userId, revokedAt: null } })
    if (activeCount >= MAX_ACTIVE_KEYS_PER_USER) {
        return { error: "limit_reached" }
    }

    const { rawKey, keyPrefix, keyHash } = generateApiKey()
    const record = await prismaAuth.apiKey.create({
        data: { userId, name: trimmedName, keyPrefix, keyHash },
        select: SUMMARY_SELECT,
    })

    return { ...record, rawKey }
}

/**
 * Scopes by userId in the `where` itself (not a separate ownership check
 * after a findUnique) so a guessed cuid can't revoke someone else's key.
 * Returns false for "not found", "not owned", and "already revoked" alike -
 * same non-distinguishing-error principle used for public API 404s.
 */
export async function revokeApiKeyForUser(userId: string, id: string): Promise<boolean> {
    const result = await prismaAuth.apiKey.updateMany({
        where: { id, userId, revokedAt: null },
        data: { revokedAt: new Date() },
    })
    return result.count > 0
}
