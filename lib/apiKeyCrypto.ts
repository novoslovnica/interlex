import { createHash, randomBytes } from "crypto"

// Shared between lib/publicApi/auth.ts (verification) and lib/apiKeys.ts
// (self-serve creation) so both sides agree on exactly one key format/hash.
export const API_KEY_PREFIX = "islx_"

export function hashApiKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex")
}

export interface GeneratedApiKey {
    rawKey: string
    keyPrefix: string
    keyHash: string
}

/** Generates a new raw key and its derived storage fields. The raw key is never stored - only keyHash is. */
export function generateApiKey(): GeneratedApiKey {
    const rawKey = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`
    return {
        rawKey,
        keyPrefix: rawKey.slice(0, 12),
        keyHash: hashApiKey(rawKey),
    }
}
