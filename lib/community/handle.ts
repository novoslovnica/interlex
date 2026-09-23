// Правила публичного ника (UserProfile.handle). Чистые функции - без БД,
// чтобы одни и те же правила работали и в server action, и в тестах.

export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 30
export const BIO_MAX_LENGTH = 300

// Ник попадает в URL (/u/<handle>) и в подписи правок, поэтому закрыты
// имена, которые выглядят как служебные или как автор-система
// ("community" - подпись автоматических записей в audit_logs).
const RESERVED_HANDLES = new Set([
    "admin", "administrator", "moderator", "mod", "root", "system", "support",
    "community", "anonymous", "anonym", "anon", "interlex", "interslavic",
    "api", "settings", "profile", "login", "logout", "me", "null", "undefined",
])

export type HandleError = "too_short" | "too_long" | "invalid_chars" | "reserved"

// Приводим к нижнему регистру до проверки: "Ivan" и "ivan" - один ник,
// иначе уникальный индекс пропустил бы двойников.
export function normalizeHandle(raw: string): string {
    return raw.trim().toLowerCase()
}

export function validateHandle(raw: string): { ok: true; handle: string } | { ok: false; error: HandleError } {
    const handle = normalizeHandle(raw)
    if (handle.length < HANDLE_MIN_LENGTH) return { ok: false, error: "too_short" }
    if (handle.length > HANDLE_MAX_LENGTH) return { ok: false, error: "too_long" }
    // Начало и конец - буква или цифра: "-ivan-" в URL и в тексте читается плохо.
    if (!/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/.test(handle)) return { ok: false, error: "invalid_chars" }
    if (RESERVED_HANDLES.has(handle)) return { ok: false, error: "reserved" }
    return { ok: true, handle }
}
