// Скрипт готов: scripts/fetch-antonyms-from-api.ts.
//     Поиск антонимов и обратных wordId в  ▀
//      Что делает:                                                                                                                                                           БД
// 1. Загружает слова из БД (Word → Meaning → En), у которых есть английский перевод
// 2. Для каждого уникального перевода вызывает https://api.dictionaryapi.dev/api/v2/entries/en/<word>, извлекает антонимы
// 3. Для каждого антонима ищет обратные вхождения в таблице en нашей БД и получает meaningId
// 4. Выводит JSON-массив { meaningId, wordId, isvWord, englishTranslation, englishAntonyms, matchedMeaningIds }
//
// Оптимизации:                                                                                                                                                          Context
// - Кеширование API-запросов (один запрос на уникальное английское слово)                                                                                               Total:            72.7k/128.0k (57%)
// - Кеширование поиска wordId по антонимам                                                                                                                              ▶ Usage by category
// - Параллельная обработка (3 concurrent запроса к API)
// - Пагинация загрузки из БД (batch по 500)                                                                                                                             MCP
// - WORD_LIMIT = 0 — все слова; можно поставить 100/200 для теста                                                                                                       • src-ide Connected
//
// Запуск: npx tsx scripts/fetch-antonyms-from-api.ts > results.json 2>progress.log

import * as path from 'path'
import fs from "fs";

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

interface AntonymResult {
    meaningId: number
    wordId: number
    isvWord: string
    englishTranslation: string
    englishAntonyms: string[]
    matchedMeaningIds: number[]
}

interface DictionaryApiEntry {
    word: string
    meanings?: {
        antonyms?: string[]
        definitions?: { antonyms?: string[] }[]
    }[]
}

// 0 = no limit (all words). Set to e.g. 100 for testing.
const WORD_LIMIT = 300
const API_DELAY_MS = 150
const MAX_CONCURRENT = 3
const BATCH_SIZE = 500

const apiCache = new Map<string, string[]>()
const antonymWordCache = new Map<string, number[]>()

async function fetchAntonyms(word: string): Promise<string[]> {
    const cached = apiCache.get(word)
    if (cached !== undefined) return cached

    try {
        const res = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
            {signal: AbortSignal.timeout(8000)},
        )

        if (res.status === 404 || !res.ok) {
            apiCache.set(word, [])
            return []
        }

        const data: DictionaryApiEntry[] | { title: string } = await res.json()

        if (!Array.isArray(data)) {
            apiCache.set(word, [])
            return []
        }

        const set = new Set<string>()
        for (const entry of data) {
            for (const m of entry.meanings ?? []) {
                for (const a of m.antonyms ?? []) {
                    const lower = a.toLowerCase().trim()
                    if (lower) set.add(lower)
                }
                for (const d of m.definitions ?? []) {
                    for (const a of d.antonyms ?? []) {
                        const lower = a.toLowerCase().trim()
                        if (lower) set.add(lower)
                    }
                }
            }
        }

        const result = Array.from(set)
        apiCache.set(word, result)
        return result
    } catch {
        apiCache.set(word, [])
        return []
    }
}

function buildMeaningLookup(db: Awaited<ReturnType<typeof import("@/lib/prisma")>>["prismaData"]) {
    return async function findMeaningIds(values: string[]): Promise<Map<string, number[]>> {
        const uncached: string[] = []
        const result = new Map<string, number[]>()

        for (const v of values) {
            const cached = antonymWordCache.get(v)
            if (cached !== undefined) {
                result.set(v, cached)
            } else {
                uncached.push(v)
            }
        }

        if (uncached.length === 0) return result

        const records = await db.en.findMany({
            where: {value: {in: uncached}},
            select: {
                value: true,
                meaningId: true,
            },
        })

        const grouped = new Map<string, Set<number>>()
        for (const r of records) {
            if (r.meaningId == null || !r.value) continue
            if (!grouped.has(r.value)) grouped.set(r.value, new Set())
            grouped.get(r.value)!.add(r.meaningId)
        }

        for (const v of uncached) {
            const ids = Array.from(grouped.get(v) ?? [])
            antonymWordCache.set(v, ids)
            result.set(v, ids)
        }

        return result
    }
}

async function main() {
    const {prismaData: db} = await import("@/lib/prisma")
    const findMeaningIds = buildMeaningLookup(db)

    console.error('Loading words with English translations...')

    let offset = 0
    let totalProcessed = 0
    const allTranslations: { meaningId: number; wordId: number; isvWord: string; translation: string }[] = []

    while (true) {
        const remaining = WORD_LIMIT ? WORD_LIMIT - totalProcessed : BATCH_SIZE
        if (WORD_LIMIT && remaining <= 0) break
        const takeSize = WORD_LIMIT ? Math.min(BATCH_SIZE, remaining) : BATCH_SIZE

        const batch = await db.word.findMany({
            where: {
                meanings: {
                    some: {en_mean: {some: {}}},
                },
            },
            select: {
                id: true,
                value: true,
                isv: true,
                meanings: {
                    select: {
                        id: true,
                        en_mean: {
                            select: {value: true},
                        },
                    },
                },
            },
            skip: offset,
            take: takeSize,
        })

        if (batch.length === 0) break

        for (const word of batch) {
            for (const meaning of word.meanings) {
                for (const en of meaning.en_mean) {
                    const val = en.value?.trim()
                    if (!val) continue
                    allTranslations.push({
                        meaningId: meaning.id,
                        wordId: word.id,
                        isvWord: word.value || word.isv || '',
                        translation: val,
                    })
                }
            }
        }

        totalProcessed += batch.length
        console.error(`Loaded ${totalProcessed} words...`)
        offset += BATCH_SIZE
    }

    console.error(`Total words: ${totalProcessed}, translation pairs: ${allTranslations.length}`)

    if (allTranslations.length === 0) {
        console.log(JSON.stringify([], null, 2))
        await db.$disconnect()
        return
    }

    console.error('Fetching antonyms from dictionaryapi.dev...')

    const results: AntonymResult[] = []
    let completed = 0

    for (let i = 0; i < allTranslations.length; i += MAX_CONCURRENT) {
        const batch = allTranslations.slice(i, i + MAX_CONCURRENT)

        const apiResults = await Promise.all(
            batch.map(async ({meaningId, wordId, isvWord, translation}) => {
                const antonyms = await fetchAntonyms(translation)
                return {meaningId, wordId, isvWord, translation, antonyms}
            }),
        )

        const apiBatch = apiResults.filter(r => r.antonyms.length > 0)

        if (apiBatch.length > 0) {
            const allAntonyms = [...new Set(apiBatch.flatMap(r => r.antonyms))]
            const lookupMap = await findMeaningIds(allAntonyms)

            for (const {meaningId, wordId, isvWord, translation, antonyms} of apiBatch) {
                const matchedIds = new Set<number>()
                for (const a of antonyms) {
                    const ids = lookupMap.get(a) ?? []
                    for (const id of ids) matchedIds.add(id)
                }

                if (matchedIds.size > 0) {
                    results.push({
                        meaningId,
                        wordId,
                        isvWord,
                        englishTranslation: translation,
                        englishAntonyms: antonyms,
                        matchedMeaningIds: Array.from(matchedIds),
                    })
                }
            }
        }

        completed += batch.length
        if (completed % 100 === 0 || completed === allTranslations.length) {
            console.error(`Progress: ${completed}/${allTranslations.length}, matches: ${results.length}, api cache: ${apiCache.size}`)
        }

        if (i + MAX_CONCURRENT < allTranslations.length) {
            await new Promise(r => setTimeout(r, API_DELAY_MS))
        }
    }

    console.error(`Done. Results: ${results.length}`)
    // console.log(JSON.stringify(results, null, 2))
    fs.writeFileSync('./antonyms.json', JSON.stringify(results, null, 2), 'utf-8');

    await db.$disconnect()
}

main().catch(e => {
    console.error('Fatal error:', e)
    process.exit(1)
})