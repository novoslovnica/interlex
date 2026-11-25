import Database from "better-sqlite3"

const slug = "kolozor-podcast"
const url = "https://open.spotify.com/show/2sykBKmfGtHNa6G3JS2e0m"
const title = "Kolozor — Poslanja, elektrony i asteroidy"
const thumbnail = "https://image-cdn-ak.spotifycdn.com/image/ab67656300005f1f6abd1db71a3f7197e4df68ca"
const apply = process.argv.includes("--apply")
const db = new Database(process.env.LIBRARY_SQLITE_DB ?? "library.db", { readonly: !apply, fileMustExist: true })

try {
    function addPodcast() {
        const existing = db.prepare<string[], { slug: string; isPublic: number }>(`
            SELECT slug, isPublic FROM MediaLibraryEntry
            WHERE url IN (?, ?)
               OR url GLOB ?
            ORDER BY isPublic DESC, id
            LIMIT 1
        `).get(url, `${url}/`, `${url}[?#]*`)
        if (existing) {
            console.log(`${existing.isPublic ? "Уже опубликован" : "Есть в каталоге как скрытая запись"}: ${existing.slug}`)
            return
        }
        if (db.prepare("SELECT 1 FROM MediaLibraryEntry WHERE slug = ?").get(slug)) {
            throw new Error(`Метка ${slug} уже занята другой записью`)
        }
        if (apply) {
            db.prepare(`
                INSERT INTO MediaLibraryEntry (slug, title, mediaType, platform, url, thumbnailUrl, language, isPublic)
                VALUES (?, ?, 'podcast', 'spotify', ?, ?, 'isv', 1)
            `).run(slug, title, url, thumbnail)
        }
        console.log(`${apply ? "Добавлен" : "К добавлению"}: ${title}`)
    }

    if (apply) db.transaction(addPodcast).immediate()
    else addPodcast()
} finally {
    db.close()
}
