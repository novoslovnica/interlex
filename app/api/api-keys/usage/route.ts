import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { listApiKeysForUser } from "@/lib/apiKeys"
import { publicApiKeyRateLimiter, PUBLIC_API_RATE_LIMIT_PER_MINUTE } from "@/lib/publicApi/rateLimit"

// Session-gated (not API-key-gated) - this is "check my own usage from the
// browser", a separate concern from the public API itself. Roadmap #58:
// ApiKey.requestCount is a lifetime total (already shown in the main list),
// it can't answer "how much of my 60/min is used right now" - only the
// live in-memory limiter knows that, and only for this process's uptime
// (same documented limitation as the limiter itself, see lib/rateLimit.ts).
export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await listApiKeysForUser(session.user.id)

    const usage = keys
        .filter((key) => !key.revokedAt)
        .map((key) => {
            const peeked = publicApiKeyRateLimiter.peek(key.id)
            return {
                id: key.id,
                windowUsed: peeked?.count ?? 0,
                windowLimit: PUBLIC_API_RATE_LIMIT_PER_MINUTE,
                windowResetInSeconds: peeked?.resetInSeconds ?? 0,
            }
        })

    return NextResponse.json({ usage })
}
