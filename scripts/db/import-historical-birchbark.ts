// Импорт UD_Old_East_Slavic-Birchbark (CC BY-SA 4.0, github.com/UniversalDependencies)
// в historical.db. Один HistoricalDocument на реальную берестяную грамоту
// (границы — комментарий "# newdoc id = texts/birchbark/NNN" в CoNLL-U, а не
// train/dev/test-сплит, который есть просто ML-удобство). Идемпотентно:
// апсерт документа по externalId, полное пересоздание его предложений/токенов
// (тот же паттерн, что upsertCorpusDocument в corpus.db).
//
// Usage: npx tsx -r dotenv/config scripts/db/import-historical-birchbark.ts

import { prismaHistorical } from "@/lib/prisma"
import { parseConllu, ConlluSentence } from "@/lib/historical/conlluParser"
import { transliterateHistoricalCyrillic } from "@/lib/historical/transliteration"

const SOURCE_CORPUS = "ud_birchbark"
const LICENSE = "CC BY-SA 4.0"
const FILES = [
    "orv_birchbark-ud-train.conllu",
    "orv_birchbark-ud-dev.conllu",
    "orv_birchbark-ud-test.conllu",
]
const BASE_URL = "https://raw.githubusercontent.com/UniversalDependencies/UD_Old_East_Slavic-Birchbark/master/"

function slugifyDocId(newdocId: string): string {
    return newdocId.trim().replace(/^texts\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()
}

async function fetchConllu(filename: string): Promise<ConlluSentence[]> {
    const res = await fetch(BASE_URL + filename)
    if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`)
    const raw = await res.text()
    return parseConllu(raw)
}

async function main() {
    const allSentences: ConlluSentence[] = []
    for (const file of FILES) {
        console.log(`Fetching ${file}...`)
        const sents = await fetchConllu(file)
        console.log(`  ${sents.length} sentences`)
        allSentences.push(...sents)
    }

    // Группируем предложения по документу (newdoc id)
    const byDoc = new Map<string, ConlluSentence[]>()
    for (const sent of allSentences) {
        const docId = sent.comments["newdoc id"]
        if (!docId) {
            console.warn("Sentence without newdoc id, skipping:", sent.comments["sent_id"])
            continue
        }
        if (!byDoc.has(docId)) byDoc.set(docId, [])
        byDoc.get(docId)!.push(sent)
    }
    console.log(`\n${byDoc.size} documents (birchbark letters), ${allSentences.length} sentences total\n`)

    let docCount = 0
    let tokenCount = 0

    for (const [newdocId, sents] of byDoc) {
        const slug = slugifyDocId(newdocId)
        const firstComments = sents[0].comments

        await prismaHistorical.$transaction(async (tx) => {
            const doc = await tx.historicalDocument.upsert({
                where: { externalId: newdocId },
                create: {
                    slug,
                    title: newdocId,
                    branch: "east",
                    period: firstComments["date_created"] || null,
                    sourceCorpus: SOURCE_CORPUS,
                    sourceUrl: "https://github.com/UniversalDependencies/UD_Old_East_Slavic-Birchbark",
                    license: LICENSE,
                    externalId: newdocId,
                },
                update: {
                    period: firstComments["date_created"] || null,
                },
            })

            // Идемпотентность: полностью пересоздаём предложения/токены документа
            // (каскадом удалятся и HistoricalToken). Тот же паттерн, что
            // upsertCorpusDocument в corpus.db.
            await tx.historicalSentence.deleteMany({ where: { documentSlug: doc.slug } })

            for (let i = 0; i < sents.length; i++) {
                const sent = sents[i]
                const sentence = await tx.historicalSentence.create({
                    data: {
                        documentSlug: doc.slug,
                        position: i,
                        rawText: sent.comments["text"] || "",
                    },
                })

                for (const tok of sent.tokens) {
                    const wf = tok.misc?.["wf"]
                    await tx.historicalToken.create({
                        data: {
                            documentSlug: doc.slug,
                            sentenceId: sentence.id,
                            tokenIndex: tok.index,
                            form: tok.form,
                            formTranslit: transliterateHistoricalCyrillic(wf || tok.form),
                            lemma: tok.lemma,
                            lemmaTranslit: transliterateHistoricalCyrillic(tok.lemma),
                            upos: tok.upos,
                            feats: tok.feats ?? undefined,
                        },
                    })
                    tokenCount++
                }
            }
        })

        docCount++
        if (docCount % 50 === 0) console.log(`  ...${docCount}/${byDoc.size} documents imported`)
    }

    console.log(`\nDone. Imported ${docCount} documents, ${tokenCount} tokens.`)
    await prismaHistorical.$disconnect()
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
