import { init } from "@/lib/sqlite"
import { resolvePublicNames } from "./identity"
import { countWordHistory, fetchWordHistory, type HistoryAuthorKind, type HistoryChange } from "./wordHistory"

// То, что уходит клиенту: без userId, автор - вид + ник (если есть).
export interface WordHistoryEntry {
    actionId: string
    createdAt: string
    author: { kind: HistoryAuthorKind; handle: string | null }
    changes: HistoryChange[]
}

export const WORD_HISTORY_PAGE = 10

// Две базы, две фазы: записи из interlex.db, ники из auth.db.
export async function loadWordHistory(lexemeId: number, params: { offset: number; limit?: number }): Promise<{ entries: WordHistoryEntry[]; total: number }> {
    const limit = Math.min(params.limit ?? WORD_HISTORY_PAGE, 50)
    const db = await init()
    let actions, total
    try {
        actions = fetchWordHistory(db, lexemeId, { limit, offset: params.offset })
        total = countWordHistory(db, lexemeId)
    } finally {
        db.close()
    }
    const names = await resolvePublicNames(actions.map((a) => a.userId))
    return {
        total,
        entries: actions.map(({ userId, authorKind, ...rest }) => ({
            ...rest,
            author: { kind: authorKind, handle: (userId && names.get(userId)) || null },
        })),
    }
}
