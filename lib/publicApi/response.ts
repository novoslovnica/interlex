import { NextResponse } from "next/server"

// A public API (external, stable contract) benefits from a machine-readable
// error `code` in a way internal admin routes (one caller: this app's own
// UI) don't - see AGENTS.md/roadmap notes on the public API. This envelope
// is deliberately a small departure from the bare `{error: "string"}` used
// elsewhere in app/api/**, not an oversight.
export interface PublicApiPagination {
    total: number
    limit: number
    offset: number
}

export function publicApiError(status: number, code: string, message: string): NextResponse {
    return NextResponse.json({ error: { code, message } }, { status })
}

export function publicApiList<T>(data: T[], total: number, limit: number, offset: number): NextResponse {
    const pagination: PublicApiPagination = { total, limit, offset }
    return NextResponse.json({ data, pagination })
}

export function publicApiItem<T>(data: T): NextResponse {
    return NextResponse.json(data)
}
