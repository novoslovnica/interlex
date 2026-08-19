/**
 * Импорт текстов из публичной коллекции "Sbir" (Box.com, gorlatoff@mail.ru,
 * см. обсуждение в AGENTS.md/чате) в корпус — по прямому запросу мейнтейнера:
 * уровни "4 Vysoky kvalitet", "3 Srědnji i nizky kvalitet", "2 Wiki, Discord,
 * Telegram" целиком + "0 Ekstremalno nizky kvalitet/izvesti.info" (163 файла,
 * компенсирует то, что штатный краулер interslavic.news/izvesti.info почти
 * не запускался — 0 документов в базе на момент написания).
 *
 * Что намеренно ИСКЛЮЧЕНО из корпуса при импорте (см. lib/box/textUtils.ts
 * EXCLUDE_NAME_PATTERNS):
 *  - "Kung Fjuri" (субтитры к фильму DreamWorks) - авторские права не выяснены
 *  - "Kratša historija časa" (перевод книги Хокинга) - идёт только в
 *    библиотеку с isPublic=false по прямому указанию мейнтейнера, не в
 *    публичный корпус
 * Только межславянские файлы (isv-тег в имени или файлы без тега из
 * подтверждённо-ISV источников - izvesti.info, "Slovjani.info (slabe
 * teksty)", "Игорь Соколов", см. isIsvTextFile) - переводы на другие языки
 * в этой же коллекции в корпус не идут.
 *
 * externalId для izvesti.info намеренно совпадает со схемой штатного
 * краулера ("izvesti:<id>", см. scripts/crawl-izvesti-info.ts) - когда тот
 * будет починен и запущен по сети, он обновит эти же строки на месте, а не
 * задублирует.
 *
 * Запуск: npm run import:box-corpus
 * Ограничить (для теста): CRAWL_LIMIT=20 npm run import:box-corpus
 */
import * as path from "path"

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), "interlex.db")}`
process.env.CORPUS_DATABASE_URL = `file:${path.resolve(process.cwd(), "corpus.db")}`

const SHARED_NAME = "8zioa8m5kf8wv40ipif9r1b76tl0r5jw"
const FOLDERS = {
    izvestiInfo: "180816420404",
    level4: "353311126829",
    level3: "357039657044",
    level2: "358387571145",
} as const

const CRAWL_LIMIT = process.env.CRAWL_LIMIT ? Number(process.env.CRAWL_LIMIT) : undefined
const MESSAGE_CHUNK_SIZE = 400

function stripIzvestiBoilerplate(raw: string): { title: string; body: string } {
    const lines = raw.split(/\r?\n/)
    const title = lines.find((l) => l.trim())?.trim() ?? "izvesti.info"
    const readIdx = lines.findIndex((l) => /^Čitanja:\s*\d+/.test(l.trim()))
    const bodyLines = readIdx === -1 ? lines.slice(1) : lines.slice(readIdx + 1)
    const body = bodyLines.join("\n").replace(/^\s+/, "").trim()
    return { title, body: body || raw.trim() }
}

async function main() {
    const { prismaCorpus } = await import("@/lib/prisma")
    const { DbAnalyzer } = await import("@/lib/corpus/tokenizer/dbAnalyzer")
    const { buildValidEndings, buildKnownPrepositions, buildCollocationRecords, buildInflectionAnomalyIndex, createQueryWordsByBase } = await import("@/lib/corpus/tokenizer/analyzer-factory")
    const { CollocationMatcher } = await import("@/lib/corpus/tokenizer/collocationMatcher")
    const { upsertCorpusDocument } = await import("@/lib/corpus/upsertDocument")
    const { computeLexiconFrequencies } = await import("@/lib/corpus/frequencies/compute-frequencies")
    const { computeCefrLevels } = await import("@/lib/corpus/frequencies/compute-cefr-levels")
    const { contentHash } = await import("@/lib/corpus/sources/htmlText")
    const { downloadBoxFolder } = await import("@/lib/box/boxClient")
    const { isIsvTextFile, isExcludedFromCorpus, isCandidateTextFile, parseLangTag, stripExt, parseAuthorTitle, firstNonEmptyLine, stableSlug, stripMarkdown } = await import("@/lib/box/textUtils")

    const analyzer = new DbAnalyzer(createQueryWordsByBase(), await buildValidEndings(), await buildKnownPrepositions(), await buildInflectionAnomalyIndex())
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    let seen = 0
    let created = 0
    let updated = 0
    let skippedUnchanged = 0
    let skippedFiltered = 0
    let failed = 0

    async function importDoc(payload: Parameters<typeof upsertCorpusDocument>[0]) {
        if (CRAWL_LIMIT !== undefined && seen >= CRAWL_LIMIT) return false
        seen++
        try {
            const result = await upsertCorpusDocument(payload, analyzer, collocationMatcher)
            if (result.status === "created") { created++; console.log(`+ [${payload.externalId}] ${payload.title}`) }
            else if (result.status === "updated") { updated++; console.log(`~ [${payload.externalId}] ${payload.title}`) }
            else skippedUnchanged++
        } catch (err) {
            failed++
            console.error(`! [${payload.externalId}]`, err instanceof Error ? err.message : err)
        }
        return CRAWL_LIMIT === undefined || seen < CRAWL_LIMIT
    }

    // --- izvesti.info (0 Ekstremalno nizky kvalitet/izvesti.info) ---
    console.log("Скачиваю izvesti.info из Box...")
    const izvestiFiles = await downloadBoxFolder(SHARED_NAME, FOLDERS.izvestiInfo)
    for (const file of izvestiFiles) {
        if (!/^\d+-/.test(file.name) || !file.name.endsWith(".txt")) continue // пропускаем result.txt/footer.txt/join.py/*.py - не отдельные статьи
        const id = Number(file.name.match(/^(\d+)-/)![1])
        const raw = file.content.toString("utf-8")
        const { title, body } = stripIzvestiBoilerplate(raw)
        if (!body) { skippedFiltered++; continue }
        const cont = await importDoc({
            title,
            slug: `izvesti-${id}`,
            rawText: body,
            language: "is",
            genre: "news",
            externalId: `izvesti:${id}`,
            sourceUrl: `https://interslavic.news/izvesti.info/index.php?option=com_content&view=article&id=${id}`,
            sourceRevisionId: contentHash(body),
        })
        if (!cont) break
    }

    // --- level 4 + level 3: обычные текстовые файлы ---
    for (const [label, folderId, genre] of [
        ["4 Vysoky kvalitet", FOLDERS.level4, "literary"],
        ["3 Srědnji i nizky kvalitet", FOLDERS.level3, "literary"],
    ] as const) {
        if (CRAWL_LIMIT !== undefined && seen >= CRAWL_LIMIT) break
        console.log(`Скачиваю "${label}" из Box...`)
        const files = await downloadBoxFolder(SHARED_NAME, folderId)
        for (const file of files) {
            if (!isCandidateTextFile(file.path)) continue // .py/.json - не текст
            if (!isIsvTextFile(file.path)) { skippedFiltered++; continue }
            if (isExcludedFromCorpus(file.name)) { skippedFiltered++; continue }
            if (file.name === "indexes.json") { skippedFiltered++; continue }

            let raw = file.content.toString("utf-8").trim()
            if (file.path.endsWith(".md")) raw = stripMarkdown(raw)
            if (!raw) { skippedFiltered++; continue }

            const { rest } = parseLangTag(file.name)
            const base = stripExt(rest).trim()
            const looksLikePageFragment = /page[_-]?\d+$/i.test(base) || /^\d{4}-\d/.test(base)
            let title: string
            let author: string | null
            if (looksLikePageFragment) {
                title = firstNonEmptyLine(raw) || base
                author = null
            } else {
                const parsed = parseAuthorTitle(base)
                title = parsed.title
                author = parsed.author
            }
            const folder = file.path.includes("/") ? file.path.split("/")[0] : null
            author = author || folder

            const externalId = `box:v${label[0]}:${file.path}`
            const cont = await importDoc({
                title,
                slug: stableSlug(title, externalId),
                rawText: raw,
                author: author ?? undefined,
                language: "is",
                genre,
                externalId,
                sourceRevisionId: contentHash(raw) ^ file.modifiedAt,
            })
            if (!cont) break
        }
    }

    // --- level 2: Wiki/Discord/Telegram ---
    if (CRAWL_LIMIT === undefined || seen < CRAWL_LIMIT) {
        console.log('Скачиваю "2 Wiki, Discord, Telegram" из Box...')
        const level2Files = await downloadBoxFolder(SHARED_NAME, FOLDERS.level2)

        for (const file of level2Files) {
            if (file.name.endsWith(".py")) continue

            if (file.name.endsWith(".json")) {
                const dumpKey = file.name.replace(/^\[isv\]\s*filtered_messages_/, "").replace(/_plain\.json$/, "")
                let messages: string[]
                try {
                    messages = JSON.parse(file.content.toString("utf-8"))
                } catch (err) {
                    console.error(`! не удалось распарсить ${file.name}:`, err)
                    failed++
                    continue
                }
                for (let i = 0; i < messages.length; i += MESSAGE_CHUNK_SIZE) {
                    const chunk = messages.slice(i, i + MESSAGE_CHUNK_SIZE).filter((m) => m && m.trim())
                    if (chunk.length === 0) continue
                    const chunkIdx = i / MESSAGE_CHUNK_SIZE
                    const rawText = chunk.join("\n")
                    const externalId = `box:messages:${dumpKey}:${chunkIdx}`
                    const cont = await importDoc({
                        title: `${dumpKey} — часть ${chunkIdx + 1}`,
                        slug: stableSlug(`messages-${dumpKey}`, externalId),
                        rawText,
                        language: "is",
                        genre: "colloquial",
                        externalId,
                        sourceRevisionId: contentHash(rawText),
                    })
                    if (!cont) break
                }
                continue
            }

            if (file.name.endsWith(".md")) {
                const md = file.content.toString("utf-8")
                const sections = md.split(/\n(?=## )/g).filter((s) => s.startsWith("## "))
                for (let i = 0; i < sections.length; i++) {
                    const section = sections[i]
                    const headerMatch = section.match(/^##\s*([^:]+):\s*(.+)/)
                    const authorRaw = headerMatch?.[1]?.trim() ?? null
                    const title = headerMatch?.[2]?.trim() || `Стаття ${i + 1}`
                    const body = section.slice(section.indexOf("\n") + 1).trim()
                    if (!body) continue
                    const looksLikeIp = authorRaw ? /^\d{1,3}(\.\d{1,3}){3}$/.test(authorRaw) : true
                    const externalId = `box:wiki:${i}:${title}`
                    const cont = await importDoc({
                        title,
                        slug: stableSlug(title, externalId),
                        rawText: body,
                        author: looksLikeIp ? undefined : authorRaw ?? undefined,
                        language: "is",
                        genre: "encyclopedic",
                        externalId,
                        sourceRevisionId: contentHash(body),
                    })
                    if (!cont) break
                }
                continue
            }
        }
    }

    console.log("\n--- Итог ---")
    console.log(`Просмотрено: ${seen}`)
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    console.log(`Пропущено (без изменений): ${skippedUnchanged}`)
    console.log(`Отфильтровано (не isv / исключено / служебный файл): ${skippedFiltered}`)
    console.log(`Ошибок: ${failed}`)

    if (created > 0 || updated > 0) {
        console.log("\nПересчитываю частотность и CEFR-уровни...")
        try {
            await computeLexiconFrequencies()
            await computeCefrLevels()
            console.log("Готово.")
        } catch (e) {
            console.error("Пересчёт частотности не удался:", e)
        }
    }

    await prismaCorpus.$disconnect()
}

main().catch((err) => {
    console.error("Импорт коллекции Box завершился с ошибкой:", err)
    process.exitCode = 1
})
