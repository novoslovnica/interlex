import AdmZip from "adm-zip"

const USER_AGENT = "InterlexCorpusCrawler/1.0 (https://interslavic-lexicon.com; contact: georgecarpow@gmail.com)"

export interface BoxFileEntry {
    /** путь внутри целевой папки, без имени самой папки (напр. "Melac/Pěsnje/song.txt") */
    path: string
    name: string
    content: Buffer
    /** unix-секунды, из заголовка zip-записи — используем как sourceRevisionId */
    modifiedAt: number
}

/**
 * Публичная "Sbir" gorlatoff@mail.ru (см. AGENTS.md/разговор в чате) не даёт
 * скачать содержимое через официальный Box API без токена, но анонимно
 * доступна через внутренний web-эндпоинт box_v2_zip_shared_folder — тот же,
 * что дёргает кнопка "Download" в интерфейсе Box для расшаренной папки.
 * Двухшаговый флоу подтверждён вручную curl'ом: шаг 1 создаёт zip-джобу и
 * возвращает подписанный download_url на public.boxcloud.com, шаг 2 отдаёт
 * сам zip. Без авторизации, без cookies — работает с чистого curl/fetch.
 */
export async function downloadBoxFolder(sharedName: string, folderId: string): Promise<BoxFileEntry[]> {
    const jobUrl = `https://app.box.com/index.php?folder_id=${folderId}&q%5Bshared_item%5D%5Bshared_name%5D=${sharedName}&rm=box_v2_zip_shared_folder`
    const jobRes = await fetch(jobUrl, { headers: { "User-Agent": USER_AGENT } })
    if (!jobRes.ok) throw new Error(`Box zip job failed for folder ${folderId}: ${jobRes.status} ${jobRes.statusText}`)

    const job = (await jobRes.json()) as { download_url?: string; result?: string }
    if (!job.download_url) throw new Error(`Box zip job for folder ${folderId} returned no download_url: ${JSON.stringify(job)}`)

    const zipRes = await fetch(job.download_url, { headers: { "User-Agent": USER_AGENT } })
    if (!zipRes.ok) throw new Error(`Box zip download failed for folder ${folderId}: ${zipRes.status} ${zipRes.statusText}`)

    const buf = Buffer.from(await zipRes.arrayBuffer())
    const zip = new AdmZip(buf)

    const entries: BoxFileEntry[] = []
    for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue
        // entryName = "<Имя папки>/<...путь>" - имя корневой папки не нужно вызывающему коду
        const parts = entry.entryName.split("/")
        const relPath = parts.length > 1 ? parts.slice(1).join("/") : parts[0]
        entries.push({
            path: relPath,
            name: parts[parts.length - 1],
            content: entry.getData(),
            modifiedAt: Math.floor(entry.header.time.getTime() / 1000),
        })
    }
    return entries
}
