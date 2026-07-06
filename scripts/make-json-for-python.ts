import * as path from 'path'
import fs from "fs";

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

// 0 = no limit (all words). Set to e.g. 100 for testing.
const WORD_LIMIT = 0
const BATCH_SIZE = 500

async function main() {
    const {prismaData: db} = await import("@/lib/prisma")

    console.error('Loading words with Russian translations...')

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
                    some: {ru_mean: {some: {}}},
                },
            },
            select: {
                id: true,
                value: true,
                isv: true,
                meanings: {
                    select: {
                        id: true,
                        ru_mean: {
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
                for (const en of meaning.ru_mean) {
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


    console.error(`Done. Results: ${allTranslations.length}`)
    // console.log(JSON.stringify(results, null, 2))
    fs.writeFileSync('./scripts/python/words.json', JSON.stringify(allTranslations, null, 2), 'utf-8');

    await db.$disconnect()
}

main().catch(e => {
    console.error('Fatal error:', e)
    process.exit(1)
})