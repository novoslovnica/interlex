const API_BASE = "https://isv.wikipedia.org/w/api.php"

// Wikimedia API:Etiquette требует описательный User-Agent с контактом для
// любого автоматизированного доступа к api.php.
const USER_AGENT = "InterlexCorpusCrawler/1.0 (https://interslavic-lexicon.com; contact: georgecarpow@gmail.com)"

export interface WikiArticleMeta {
    pageId: number
    title: string
    revisionId: number
    fullUrl: string
}

interface AllPagesApiResponse {
    continue?: { gapcontinue?: string }
    query?: {
        pages?: Record<
            string,
            {
                pageid: number
                title: string
                ns: number
                missing?: string
                revisions?: { revid: number }[]
                fullurl?: string
            }
        >
    }
}

interface ExtractApiResponse {
    query?: {
        pages?: Record<
            string,
            {
                extract?: string
            }
        >
    }
}

async function apiGet<T>(params: Record<string, string>): Promise<T> {
    const url = new URL(API_BASE)
    url.search = new URLSearchParams({ format: "json", maxlag: "5", ...params }).toString()

    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
    if (!res.ok) {
        throw new Error(`isv.wikipedia.org API request failed: ${res.status} ${res.statusText}`)
    }
    return (await res.json()) as T
}

/**
 * Перечисляет все статьи основного пространства имён (ns=0, без редиректов)
 * с их текущим revisionId — по нему краулер решает, изменилась ли страница
 * с прошлого запуска, не скачивая текст заново без нужды.
 */
export async function* listArticles(): AsyncGenerator<WikiArticleMeta> {
    let gapcontinue: string | undefined

    do {
        const data = await apiGet<AllPagesApiResponse>({
            action: "query",
            generator: "allpages",
            gapnamespace: "0",
            gapfilterredir: "nonredirects",
            gaplimit: "100",
            prop: "info|revisions",
            rvprop: "ids",
            inprop: "url",
            ...(gapcontinue ? { gapcontinue } : {}),
        })

        const pages = Object.values(data.query?.pages ?? {})
        for (const page of pages) {
            if (page.missing !== undefined || !page.revisions?.length) continue
            yield {
                pageId: page.pageid,
                title: page.title,
                revisionId: page.revisions[0].revid,
                fullUrl: page.fullurl ?? `https://isv.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
            }
        }

        gapcontinue = data.continue?.gapcontinue
    } while (gapcontinue)
}

/**
 * Возвращает чистый текст статьи (без вики-разметки) через расширение
 * TextExtracts. exlimit сворачивается MediaWiki до 1 при explaintext=1,
 * поэтому запрос делается по одной странице за раз.
 */
export async function fetchArticleExtract(pageId: number): Promise<string> {
    const data = await apiGet<ExtractApiResponse>({
        action: "query",
        prop: "extracts",
        explaintext: "1",
        pageids: String(pageId),
    })

    const page = data.query?.pages?.[String(pageId)]
    return page?.extract ?? ""
}
