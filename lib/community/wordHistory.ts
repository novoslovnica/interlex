import type Database from "better-sqlite3"

// Публичная история изменений слова (roadmap п.61): audit_logs по лексеме,
// сгруппированные по actionId (одно сохранение = одна запись), только
// публичные поля. userEmail в запрос не входит вообще - автор наружу
// выходит как "сообщество" / "автоматически" / ник или "модератор"
// (identity.ts), никогда как e-mail.

export type HistoryAuthorKind = "community" | "script" | "moderator"

export interface HistoryChange {
    field: string
    oldValue: string | null
    newValue: string | null
}

export interface HistoryAction {
    actionId: string
    createdAt: string
    authorKind: HistoryAuthorKind
    userId: string | null // для подстановки ника вызывающим; наружу не отдаётся
    changes: HistoryChange[]
}

// Что показываем. Служебное скрыто: *.message (заметки модератора),
// *.verified (внутренняя отметка), частотность и валентность (машинные
// поля), inflectionAnomaly (сырые формы).
const PUBLIC_FIELDS = new Set(["value", "stem", "pos", "gender", "animacy", "declension", "conjugation", "properNoun", "isv", "nsl", "mergedFrom"])
const PUBLIC_FIELD_SQL = `(field IN (${[...PUBLIC_FIELDS].map((f) => `'${f}'`).join(",")}) OR field LIKE '%.value' OR field LIKE '%.communityStatus' OR field LIKE '%.created')`

export function isPublicHistoryField(field: string): boolean {
    return PUBLIC_FIELDS.has(field) || /\.(value|communityStatus|created)$/.test(field)
}

export function classifyAuthor(userEmail: string, userId: string | null): HistoryAuthorKind {
    if (userEmail === "community") return "community"
    if (!userId && /^(script|system):/.test(userEmail)) return "script"
    return "moderator"
}

export function countWordHistory(db: Database.Database, lexemeId: number): number {
    return (db.prepare(`SELECT COUNT(DISTINCT actionId) AS c FROM audit_logs WHERE entityType = 'Lexeme' AND entityId = ? AND ${PUBLIC_FIELD_SQL}`)
        .get(lexemeId) as { c: number }).c
}

export function fetchWordHistory(db: Database.Database, lexemeId: number, params: { limit: number; offset: number }): HistoryAction[] {
    const actions = db.prepare(`
        SELECT actionId, MAX(createdAt) AS createdAt, MIN(userEmail) AS userEmail, MIN(userId) AS userId
        FROM audit_logs WHERE entityType = 'Lexeme' AND entityId = ? AND ${PUBLIC_FIELD_SQL}
        GROUP BY actionId ORDER BY createdAt DESC, MAX(id) DESC LIMIT ? OFFSET ?
    `).all(lexemeId, params.limit, params.offset) as { actionId: string; createdAt: string; userEmail: string; userId: string | null }[]
    if (actions.length === 0) return []

    const placeholders = actions.map(() => "?").join(",")
    const rows = db.prepare(`
        SELECT actionId, field, oldValue, newValue FROM audit_logs
        WHERE actionId IN (${placeholders}) AND entityType = 'Lexeme' AND entityId = ? AND ${PUBLIC_FIELD_SQL} ORDER BY id
    `).all(...actions.map((a) => a.actionId), lexemeId) as (HistoryChange & { actionId: string })[]
    const byAction = new Map<string, HistoryChange[]>()
    for (const row of rows) {
        const list = byAction.get(row.actionId) ?? []
        list.push({ field: row.field, oldValue: row.oldValue, newValue: row.newValue })
        byAction.set(row.actionId, list)
    }
    return actions.map((a) => ({
        actionId: a.actionId,
        createdAt: a.createdAt,
        authorKind: classifyAuthor(a.userEmail, a.userId),
        userId: a.userId,
        changes: byAction.get(a.actionId) ?? [],
    }))
}
