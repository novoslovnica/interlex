import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { init } from "@/lib/sqlite"
import { selectNextCard } from "@/lib/community/translationCards"
import { getUserLanguageCodes } from "@/lib/community/access"
import { selectControlCard, shouldServeControl } from "@/lib/community/controlCards"
import { signCard } from "@/lib/community/cardToken"

// Самообслуживание залогиненного пользователя - только сессия, без Feature
// (как FlashcardProgress/ApiKey). Язык обязан быть среди языков, которые
// пользователь сам указал в настройках.
export async function GET(request: NextRequest) {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const language = new URL(request.url).searchParams.get("lang") ?? ""
    const languages = await getUserLanguageCodes(userId)
    if (!languages.includes(language)) {
        return NextResponse.json({ error: "Language is not among your languages" }, { status: 403 })
    }

    const db = await init()
    try {
        const regular = selectNextCard(db, { userId, language })
        // Только контрольными не кормим: нет настоящей работы - карточки закончились.
        if (!regular) return NextResponse.json({ done: true })

        const control = shouldServeControl(db, userId, language) ? selectControlCard(db, { userId, language }) : null
        const card = control?.card ?? regular
        // Токен есть у каждой карточки и выглядит одинаково - по ответу
        // сервера контрольную от обычной не отличить.
        const token = signCard(control?.kind ?? "regular", card.translationId, userId)
        return NextResponse.json({ done: false, card, token })
    } finally {
        db.close()
    }
}
