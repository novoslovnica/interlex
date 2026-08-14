// Импорт UD_Old_Church_Slavonic-PROIEL (CC BY-NC-SA 4.0, некоммерч. — ок для
// этого проекта) в historical.db. В отличие от Birchbark, тут нет "newdoc id"
// — границы документа задаёт комментарий "# source = <название памятника>"
// (напр. "Kiev Missal, On the same day of St. Felicitas"), который повторяется
// у каждого предложения одного отрывка. FORM тут уже чистый (нет editorial-
// апарата в скобках, как у грамот) — транслитерируем напрямую, без "wf".
//
// Usage: npx tsx -r dotenv/config scripts/db/import-historical-ocs.ts

import { prismaHistorical } from "@/lib/prisma"
import { parseConllu, ConlluSentence } from "@/lib/historical/conlluParser"
import { transliterateHistoricalCyrillic } from "@/lib/historical/transliteration"

const SOURCE_CORPUS = "ud_ocs_proiel"
const LICENSE = "CC BY-NC-SA 4.0"
const FILES = ["cu_proiel-ud-train.conllu", "cu_proiel-ud-dev.conllu", "cu_proiel-ud-test.conllu"]
const BASE_URL = "https://raw.githubusercontent.com/UniversalDependencies/UD_Old_Church_Slavonic-PROIEL/master/"

function slugifySource(source: string): string {
    return source.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 80)
}

async function fetchConllu(filename: string): Promise<ConlluSentence[]> {
    const res = await fetch(BASE_URL + filename)
    if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`)
    return parseConllu(await res.text())
}

async function main() {
    const allSentences: ConlluSentence[] = []
    for (const file of FILES) {
        console.log(`Fetching ${file}...`)
        const sents = await fetchConllu(file)
        console.log(`  ${sents.length} sentences`)
        allSentences.push(...sents)
    }

    const byDoc = new Map<string, ConlluSentence[]>()
    for (const sent of allSentences) {
        const source = sent.comments["source"]
        if (!source) {
            console.warn("Sentence without source, skipping:", sent.comments["sent_id"])
            continue
        }
        if (!byDoc.has(source)) byDoc.set(source, [])
        byDoc.get(source)!.push(sent)
    }
    console.log(`\n${byDoc.size} documents (source texts), ${allSentences.length} sentences total\n`)

    let docCount = 0
    let tokenCount = 0

    for (const [source, sents] of byDoc) {
        // Слаг по источнику может не быть уникальным при усечении длинных
        // названий — добавляем короткий суффикс по числу уже виденных коллизий.
        let slug = slugifySource(source)
        let suffix = 1
        const baseSlug = slug
        while (await prismaHistorical.historicalDocument.findFirst({ where: { slug, NOT: { externalId: source } } })) {
            slug = `${baseSlug}-${++suffix}`
        }

        await prismaHistorical.$transaction(async (tx) => {
            const doc = await tx.historicalDocument.upsert({
                where: { externalId: source },
                create: {
                    slug,
                    title: source,
                    branch: "south",
                    period: null,
                    sourceCorpus: SOURCE_CORPUS,
                    sourceUrl: "https://github.com/UniversalDependencies/UD_Old_Church_Slavonic-PROIEL",
                    license: LICENSE,
                    externalId: source,
                },
                update: {},
            })

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
                    await tx.historicalToken.create({
                        data: {
                            documentSlug: doc.slug,
                            sentenceId: sentence.id,
                            tokenIndex: tok.index,
                            form: tok.form,
                            formTranslit: transliterateHistoricalCyrillic(tok.form),
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
