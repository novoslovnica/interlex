/**
 * Импорт текстов из коллекции "Sbir" (Box.com, gorlatoff@mail.ru) в
 * библиотеку (library.db) — по прямому запросу мейнтейнера:
 *  - авторские папки из "4 Vysoky kvalitet": Melac, Roberto Lombino,
 *    Alla Sokolova, Rubinolas (только isv-файлы каждой)
 *  - "interslavic_news" (56 файлов, только isv-версии статей)
 *  - "Kratša historija časa" (перевод книги Хокинга) - ОТДЕЛЬНО, с
 *    isPublic=false: мейнтейнер сам ещё не смотрел текст, авторские права
 *    на перевод коммерческой книги не выяснены (см. AGENTS.md/обсуждение) -
 *    запись создаётся скрытой от публики, доступна только в админке
 *
 * "Tajny Blagograda" сюда намеренно не входит - по словам мейнтейнера,
 * уже есть в библиотеке.
 *
 * Все записи создаются verified=false - требуют ревью модератора, как и
 * остальной автоматически затянутый контент в этом проекте (ср.
 * CorpusCandidateProposal, MediaLibraryEntry из crawl-media-library.ts).
 *
 * Идемпотентно: upsert по slug (stableSlug от заголовка + пути файла в Box).
 * После импорта нужно (не входит в этот скрипт, отдельный шаг):
 *   npx tsx scripts/db/backfill-library-readability.ts
 *
 * Запуск: npm run import:box-library
 */
import * as path from "path"

process.env.LIBRARY_DATABASE_URL = `file:${path.resolve(process.cwd(), "library.db")}`

const SHARED_NAME = "8zioa8m5kf8wv40ipif9r1b76tl0r5jw"
const LEVEL4_FOLDER_ID = "353311126829" // "4 Vysoky kvalitet"

const AUTHOR_FOLDERS = ["Melac", "Roberto Lombino", "Alla Sokolova", "Rubinolas"] as const
const SOURCE_LABEL = 'Box "Sbir" (gorlatoff@mail.ru)'

async function main() {
    const { prismaLibrary } = await import("@/lib/prisma")
    const { downloadBoxFolder } = await import("@/lib/box/boxClient")
    const { isCandidateTextFile, parseLangTag, stripExt, parseAuthorTitle, stableSlug, stripMarkdown } = await import("@/lib/box/textUtils")

    console.log('Скачиваю "4 Vysoky kvalitet" из Box...')
    const files = await downloadBoxFolder(SHARED_NAME, LEVEL4_FOLDER_ID)

    let created = 0
    let updated = 0
    let skipped = 0
    let failed = 0

    async function upsertEntry(data: {
        title: string
        author: string | null
        genre: string
        body: string
        relPath: string
        isPublic: boolean
        translator?: string | null
    }) {
        const slug = stableSlug(data.title, data.relPath)
        try {
            const existing = await prismaLibrary.libraryEntry.findUnique({ where: { slug } })
            const payload = {
                title: data.title,
                author: data.author,
                genre: data.genre,
                body: data.body,
                bodyLength: data.body.length,
                source: SOURCE_LABEL,
                translator: data.translator ?? null,
                isPublic: data.isPublic,
                addedBy: "import:box-collection",
            }
            if (existing) {
                await prismaLibrary.libraryEntry.update({ where: { slug }, data: payload })
                updated++
                console.log(`~ [${slug}] ${data.title}`)
            } else {
                await prismaLibrary.libraryEntry.create({ data: { ...payload, slug, verified: false } })
                created++
                console.log(`+ [${slug}] ${data.title}`)
            }
        } catch (err) {
            failed++
            console.error(`! [${slug}]`, err instanceof Error ? err.message : err)
        }
    }

    // --- авторские папки ---
    for (const folder of AUTHOR_FOLDERS) {
        const folderFiles = files.filter((f) => f.path.startsWith(`${folder}/`) && isCandidateTextFile(f.path))
        for (const file of folderFiles) {
            const name = file.path.split("/").pop()!
            const { tag, rest } = parseLangTag(name)
            if (tag !== "isv") { skipped++; continue }

            let body = file.content.toString("utf-8").trim()
            if (file.path.endsWith(".md")) body = stripMarkdown(body)
            if (!body) { skipped++; continue }

            const base = stripExt(rest).trim()
            const parsed = parseAuthorTitle(base)
            const title = parsed.title || base
            const genre = file.path.includes("/Pěsnje/") ? "song" : "article"

            await upsertEntry({ title, author: folder, genre, body, relPath: file.path, isPublic: true })
        }
    }

    // --- interslavic_news ---
    const newsFiles = files.filter((f) => f.path.startsWith("interslavic_news/") && isCandidateTextFile(f.path))
    for (const file of newsFiles) {
        const name = file.path.split("/").pop()!
        const { tag, rest } = parseLangTag(name)
        if (tag !== "isv") { skipped++; continue }

        const body = file.content.toString("utf-8").trim()
        if (!body) { skipped++; continue }

        const firstLine = body.split(/\r?\n/).find((l) => l.trim())?.trim()
        const title = firstLine || stripExt(rest).trim()

        await upsertEntry({ title, author: null, genre: "news", body, relPath: file.path, isPublic: true })
    }

    // --- Kratša historija časa (Hawking, isPublic=false) ---
    const hawkingFile = files.find((f) => /\[isv\].*havking/i.test(f.path))
    if (hawkingFile) {
        const body = hawkingFile.content.toString("utf-8").trim()
        await upsertEntry({
            title: "Kratša historija časa",
            author: "Stiven Havking",
            translator: "Mihal Swat",
            genre: "nonfiction",
            body,
            relPath: hawkingFile.path,
            isPublic: false,
        })
    } else {
        console.error("! Файл перевода Хокинга не найден в level 4 - проверьте имя файла в Box")
        failed++
    }

    console.log("\n--- Итог ---")
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    console.log(`Пропущено (не isv / пусто): ${skipped}`)
    console.log(`Ошибок: ${failed}`)
    console.log("\nНе забудь пересчитать читабельность: npx tsx scripts/db/backfill-library-readability.ts")

    await prismaLibrary.$disconnect()
}

main().catch((err) => {
    console.error("Импорт коллекции Box в библиотеку завершился с ошибкой:", err)
    process.exitCode = 1
})
