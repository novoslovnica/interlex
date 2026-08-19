/**
 * Обновление метаданных медиатеки (MediaLibraryEntry, library.db) по заранее
 * курируемому списку YouTube-каналов и подкастов — забирает title/description/
 * og:image со страницы источника через статические og:-теги (без API-ключей,
 * см. lib/media/scrapeMeta.ts — проверено эмпирически на youtube.com и
 * open.spotify.com, оба отдают og:-теги в исходном HTML без JS-рендеринга).
 *
 * Идемпотентно: ищет существующую запись по url. Если нашлась — обновляет
 * только "забираемые" поля (title/description/thumbnailUrl), не трогает
 * mediaType/platform/language/slug/verified/isPublic — это модераторские
 * поля, скрипт их никогда не переписывает. Если не нашлась — создаёт новую
 * с verified=false (требует ревью модератора перед публичным доверием).
 *
 * Список источников — не автообнаружение, а вручную проверенный сид (см.
 * MEDIA_SEED ниже). TikTok и interslavic.news/podkast сюда не входят:
 * TikTok не отдаёт og:-теги без JS, interslavic.news/podkast вернул пустой
 * ответ при проверке (тот же слабо поддерживаемый хостинг, что и
 * interslavic.news/izvesti.info, см. lib/corpus/sources/izvestiClient.ts).
 *
 * Запуск: npm run crawl:media-library
 */
import * as path from "path"

process.env.LIBRARY_DATABASE_URL = `file:${path.resolve(process.cwd(), "library.db")}`

interface MediaSeed {
    url: string
    mediaType: "podcast" | "youtube_channel" | "video" | "audio_track" | "other"
    platform: "youtube" | "spotify" | "soundcloud" | "apple_podcasts" | "other"
    language: string
}

const MEDIA_SEED: MediaSeed[] = [
    { url: "https://www.youtube.com/@interslavicofficial", mediaType: "youtube_channel", platform: "youtube", language: "isv" },
    { url: "https://www.youtube.com/channel/UCAcdRi8frHY15DbNxbC4yDQ", mediaType: "youtube_channel", platform: "youtube", language: "isv" },
    { url: "https://www.youtube.com/@vojtieh", mediaType: "youtube_channel", platform: "youtube", language: "isv" },
    { url: "https://www.youtube.com/@RanmaruRei", mediaType: "youtube_channel", platform: "youtube", language: "isv" },
    { url: "https://www.youtube.com/@MudrostiGlupostiPodcast", mediaType: "podcast", platform: "youtube", language: "isv" },
    { url: "https://open.spotify.com/show/3nUXqWTxtvWBYO6pT7l9gp", mediaType: "podcast", platform: "spotify", language: "isv" },
]

function slugify(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
}

async function main() {
    const { prismaLibrary } = await import("@/lib/prisma")
    const { scrapePageMeta } = await import("@/lib/media/scrapeMeta")

    let created = 0
    let updated = 0
    let unchanged = 0
    let failed = 0

    for (const seed of MEDIA_SEED) {
        try {
            const meta = await scrapePageMeta(seed.url)
            if (!meta.title) {
                failed++
                console.error(`! [${seed.url}] og:title не найден — страница не отдала метаданные`)
                continue
            }

            const existing = await prismaLibrary.mediaLibraryEntry.findFirst({ where: { url: seed.url } })

            if (!existing) {
                let slug = slugify(meta.title)
                if (await prismaLibrary.mediaLibraryEntry.findUnique({ where: { slug } })) {
                    slug = `${slug}-${seed.platform}`
                }
                await prismaLibrary.mediaLibraryEntry.create({
                    data: {
                        title: meta.title,
                        slug,
                        mediaType: seed.mediaType,
                        url: seed.url,
                        platform: seed.platform,
                        description: meta.description,
                        thumbnailUrl: meta.thumbnailUrl,
                        language: seed.language,
                        verified: false,
                        isPublic: true,
                        addedBy: "crawler:media-metadata",
                    },
                })
                created++
                console.log(`+ [${seed.url}] ${meta.title}`)
                continue
            }

            const changed =
                existing.title !== meta.title ||
                existing.description !== meta.description ||
                existing.thumbnailUrl !== meta.thumbnailUrl

            if (!changed) {
                unchanged++
                continue
            }

            await prismaLibrary.mediaLibraryEntry.update({
                where: { id: existing.id },
                data: {
                    title: meta.title,
                    description: meta.description,
                    thumbnailUrl: meta.thumbnailUrl,
                },
            })
            updated++
            console.log(`~ [${seed.url}] ${meta.title}`)
        } catch (err) {
            failed++
            console.error(`! [${seed.url}]`, err instanceof Error ? err.message : err)
        }
    }

    console.log("\n--- Итог ---")
    console.log(`Создано: ${created}`)
    console.log(`Обновлено: ${updated}`)
    console.log(`Без изменений: ${unchanged}`)
    console.log(`Ошибок: ${failed}`)

    await prismaLibrary.$disconnect()
}

main().catch((err) => {
    console.error("Краулер медиатеки завершился с ошибкой:", err)
    process.exitCode = 1
})
