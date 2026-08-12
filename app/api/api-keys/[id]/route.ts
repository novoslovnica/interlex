import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { revokeApiKeyForUser } from "@/lib/apiKeys"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const revoked = await revokeApiKeyForUser(session.user.id, id)
    if (!revoked) {
        return NextResponse.json({ error: "Key not found" }, { status: 404 })
    }

    return NextResponse.json({ revoked: true })
}
