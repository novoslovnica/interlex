/**
 * Импорт "Emmy Noether: Complete Interslavic Corpus Edition"
 * (https://github.com/KokunoYumeto/emmy-noether-isv) в библиотеку — та же
 * коллекция, что и import-noether-corpus.ts, тексты те же, назначение
 * другое (читаемые статьи vs токенизированный корпус). См. комментарий в
 * import-noether-corpus.ts про лицензию (CC0 на перевод) и оговорку
 * источника про "machine-assisted, not peer-reviewed" перевод.
 *
 * Paper 45 - совместна statja H. Kapferera i E. Noether (avtor v tekstě:
 * "s dodatkom, společně s E. Noether") - author указан обоим.
 *
 * Идемпотентно: upsert по slug.
 * После импорта: npx tsx scripts/db/backfill-library-readability.ts
 *
 * Запуск: npm run import:noether-library
 */
import * as path from "path"

process.env.LIBRARY_DATABASE_URL = `file:${path.resolve(process.cwd(), "library.db")}`

const SOURCE_LABEL = "GitHub: KokunoYumeto/emmy-noether-isv (CC0, перевод)"
const EDITORIAL_NOTE = "Machine-assisted scholarly working edition — not peer-reviewed, no native-speaker/community certification claimed (см. README источника)."

async function main() {
    const { prismaLibrary } = await import("@/lib/prisma")
    const { fetchNoetherPapers1to43, fetchNoetherBook44, fetchNoetherPaper45 } = await import("@/lib/noether/noetherClient")
    const { slugify } = await import("@/lib/box/textUtils")

    let created = 0
    let updated = 0
    let failed = 0

    async function upsertEntry(id: string, title: string, author: string, genre: string, body: string) {
        const slug = `noether-${slugify(id)}`
        try {
            const existing = await prismaLibrary.libraryEntry.findUnique({ where: { slug } })
            const payload = {
                title,
                author,
                genre,
                body,
                bodyLength: body.length,
                source: SOURCE_LABEL,
                summary: EDITORIAL_NOTE,
                isPublic: true,
                addedBy: "import:emmy-noether-isv",
            }
            if (existing) {
                await prismaLibrary.libraryEntry.update({ where: { slug }, data: payload })
                updated++
                console.log(`~ [${slug}] ${title}`)
            } else {
                await prismaLibrary.libraryEntry.create({ data: { ...payload, slug, verified: false } })
                created++
                console.log(`+ [${slug}] ${title}`)
            }
        } catch (err) {
            failed++
            console.error(`! [${slug}]`, err instanceof Error ? err.message : err)
        }
    }

    console.log("Скачиваю papers 1-43...")
    const papers = await fetchNoetherPapers1to43()
    for (const p of papers) {
        await upsertEntry(p.id, p.title, "Emmy Noether", "academic", p.body)
    }

    console.log("Скачиваю Work 44...")
    const book = await fetchNoetherBook44()
    for (const b of book) {
        await upsertEntry(b.id, b.title, "Emmy Noether", "textbook", b.body)
    }

    console.log("Скачиваю Paper 45...")
    const p45 = await fetchNoetherPaper45()
    await upsertEntry(p45.id, p45.title, "H. Kapferer, Emmy Noether", "academic", p45.body)

    console.log("\n--- Итог ---")
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    console.log(`Ошибок: ${failed}`)
    console.log("\nНе забудь пересчитать читабельность: npx tsx scripts/db/backfill-library-readability.ts")

    await prismaLibrary.$disconnect()
}

main().catch((err) => {
    console.error("Импорт emmy-noether-isv в библиотеку завершился с ошибкой:", err)
    process.exitCode = 1
})
