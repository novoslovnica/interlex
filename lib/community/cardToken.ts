import { createHmac, timingSafeEqual } from "crypto"

// Подпись карточки. Сервер не хранит, какую карточку кому показал: вид
// карточки (обычная / контрольная с ответом "верно" / контрольная-обманка)
// зашит в HMAC, который клиент возвращает вместе с ответом. Вид в токене не
// читается - это не закодированное поле, а подпись; сервер узнаёт его,
// перебирая три возможных вида и сравнивая подписи. Токен привязан к
// пользователю и переводу, так что чужой или от другой карточки не подойдёт.
// Срока жизни нет намеренно: повторно ответить всё равно не даёт уникальный
// индекс действующего голоса.

export type CardKind = "regular" | "control_yes" | "control_no"

const CARD_KINDS: CardKind[] = ["regular", "control_yes", "control_no"]

function secret(): string {
    const value = process.env.AUTH_SECRET
    if (!value) throw new Error("AUTH_SECRET is not set - cannot sign community cards")
    return value
}

export function signCard(kind: CardKind, translationId: number, userId: string): string {
    return createHmac("sha256", secret()).update(`community-card|${kind}|${translationId}|${userId}`).digest("base64url")
}

export function resolveCardKind(token: string, translationId: number, userId: string): CardKind | null {
    const given = Buffer.from(token)
    for (const kind of CARD_KINDS) {
        const expected = Buffer.from(signCard(kind, translationId, userId))
        if (given.length === expected.length && timingSafeEqual(given, expected)) return kind
    }
    return null
}
