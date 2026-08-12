import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { listApiKeysForUser, createApiKeyForUser } from "@/lib/apiKeys"

export async function GET() {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await listApiKeysForUser(session.user.id)
    return NextResponse.json({ keys })
}

export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name : ""

    const result = await createApiKeyForUser(session.user.id, name)
    if ("error" in result) {
        const messages = {
            invalid_name: "Name is required (max 60 characters).",
            limit_reached: "You've reached the maximum of 20 active API keys.",
        }
        return NextResponse.json({ error: messages[result.error] }, { status: 400 })
    }

    return NextResponse.json(result)
}
