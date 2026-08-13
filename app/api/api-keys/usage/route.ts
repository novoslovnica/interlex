import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { listApiKeysForUser } from "@/lib/apiKeys"
import { publicApiRateLimiters, PUBLIC_API_RATE_LIMITS, type PublicApiCategory } from "@/lib/publicApi/rateLimit"

const CATEGORIES: PublicApiCategory[] = ["words", "library", "corpus"]

// Session-gated (not API-key-gated) - this is "check my own usage from the
// browser", a separate concern from the public API itself. Roadmap #58/#38:
// ApiKey.requestCount is a lifetime total (already shown in the main list),
// it can't answer "how much of my current window is used" - only the live
// in-memory limiters know that, per category, and only for this process's
// uptime (same documented limitation as the limiters themselves).
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await listApiKeysForUser(session.user.id)

    const usage = keys
        .filter((key) => !key.revokedAt)
        .map((key) => {
            const categories = Object.fromEntries(
                CATEGORIES.map((category) => {
                    const limit = key.rateLimitOverride ?? PUBLIC_API_RATE_LIMITS[category]
                    const peeked = publicApiRateLimiters[category].peek(key.id, undefined, limit)
                    return [category, {
                        windowUsed: peeked?.count ?? 0,
                        windowLimit: limit,
                        windowResetInSeconds: peeked?.resetInSeconds ?? 0,
                    }]
                }),
            )
            return { id: key.id, rateLimitOverride: key.rateLimitOverride, categories }
        })

    return NextResponse.json({ usage })
}
