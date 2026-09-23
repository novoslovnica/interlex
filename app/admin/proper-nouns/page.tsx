import { auth } from "@/auth"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { requirePermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { init } from "@/lib/sqlite"
import { countProperNounQueue, fetchProperNounQueue } from "@/lib/community/properNounReview"
import ProperNounsClient from "./proper-nouns-client"

export const metadata: Metadata = {
    title: "Имена собственные | Админ-панель",
    description: "Быстрый разбор флага properNoun: у каких слов переводы пишутся с заглавной буквы.",
}

const PAGE_SIZE = 100

// Без пагинации по номеру: решённые строки уходят из очереди, и следующая
// сотня всегда первая. Флаг properNoun - поле лексемы, поэтому право - WordsEdit.
export default async function ProperNounsPage() {
    const session = await auth()
    if (!session) redirect("/login")
    await requirePermission(session, Feature.WordsEdit)

    const db = await init()
    let items, counts
    try {
        items = fetchProperNounQueue(db, { limit: PAGE_SIZE, offset: 0 })
        counts = countProperNounQueue(db)
    } finally {
        db.close()
    }

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto w-full overflow-y-auto">
            <div>
                <h1 className="text-xl font-bold">Имена собственные</h1>
                <p className="text-sm text-muted-foreground">
                    Слова без флага «имя собственное», у которых переводы написаны с заглавной буквы. Отметьте те, что действительно
                    имена (города, страны, народы, личные имена) — им ставится флаг. У остальных первая буква переводов опускается.
                    Немецкий, нидерландский, эсперанто и церковнославянский не трогаются.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    В очереди: {counts.total}, из них предложено как имена: {counts.suggested}. Предложенные стоят первыми и уже отмечены —
                    сигналы: все вычитанные языки пишут с заглавной, либо слово пишется с заглавной в середине предложения в корпусе.
                    Очередь пересчитывается скриптом <code>scripts/db/compute-proper-noun-signals.ts</code>.
                </p>
            </div>
            <ProperNounsClient items={items} />
        </div>
    )
}
