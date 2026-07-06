import * as path from 'path'
import fs from 'fs'
import {init} from "@/lib/sqlite";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

process.env.DATA_DATABASE_URL = `file:${path.resolve(process.cwd(), 'interlex.db')}`

interface RootResult {
    meaningId: number
    wordId: number
    isvWord: string
    synonyms: string[];
    antonyms: string[];
}

async function main() {
    const { prismaData: db } = await import('@/lib/prisma')

    const inputPath = path.resolve(process.cwd(), './scripts/python/words_enriched.json')
    const data: RootResult[] = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    let updatedSynonyms = 0
    let updatedAntonyms = 0
    let skippedSynonyms = 0
    let skippedAntonyms = 0

    const dbSimple = await init();

    for (const entry of data) {
        if (!entry.meaningId) {
            continue
        }
        if (!entry.synonyms.length) {
            skippedSynonyms++
        }
        if (!entry.antonyms.length) {
            skippedAntonyms++
        }

        for (const word of entry.synonyms) {
            const ruLange = dbSimple.prepare(`select * from ru where value = ?`).get(word);

            if (ruLange) {
                dbSimple.prepare(`insert into synonims (sourceId, targetId) values (?, ?)`)
                    .run(
                        entry.meaningId,
                        ruLange.meaningId,
                    )
                updatedSynonyms++
            }

            // await db.ru.findFirst({
            //     where: {
            //         value: {
            //             equals: word,
            //         },
            //     }
            // }).then((meaning) => {
            //     console.log(meaning);
            //     if (meaning) {
            //         db.synonym.create({
            //             data: {
            //                 sourceId: entry.meaningId,
            //                 targetId: meaning.meaningId,
            //             },
            //         }).catch((e) => {
            //             console.error(e)
            //         })
            //         updatedSynonyms++
            //     }
            // }).catch((e) => {
            //     console.error(e)
            // });
        }

        for (const word of entry.antonyms) {
            const ruLange = dbSimple.prepare(`select * from ru where value = ?`).get(word);

            if (ruLange) {
                dbSimple.prepare(`insert into antonims (sourceId, targetId) values (?, ?)`)
                    .run(
                        entry.meaningId,
                        ruLange.meaningId,
                    )
                updatedAntonyms++
            }

            // db.ru.findFirst({
            //     where: {
            //         value: {
            //             equals: word,
            //         },
            //     }
            // }).then((meaning) => {
            //     if (meaning) {
            //         db.antonym.create({
            //             data: {
            //                 sourceId: entry.meaningId,
            //                 targetId: meaning.meaningId,
            //             },
            //         })
            //         updatedAntonyms++
            //     }
            // });
        }
    }

    console.error(`Updated synonyms: ${updatedSynonyms}, skipped ${skippedSynonyms}`)
    console.error(`Updated antonyms: ${updatedAntonyms}, skipped ${skippedAntonyms}`)
    await db.$disconnect()
}

main().catch(e => {
    console.error('Fatal error:', e)
    process.exit(1)
})