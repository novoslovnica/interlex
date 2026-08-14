// Импорт "Annotated Corpus of Pre-Standardized Balkan Slavic Literature" (CLARIN.SI
// 11356/1441, CC BY-SA 4.0, дамаскины, XV-XIX вв., болгарский/македонский) в
// historical.db. В отличие от Birchbark/OCS, файл лежит одним ZIP-архивом на
// CLARIN, не постранично на GitHub — качаем, распаковываем через системный
// unzip (Node без внешних зависимостей zip не умеет), парсим единственный
// .conllu внутри. FORM/LEMMA тут УЖЕ в основном в латинице (не кириллице,
// как в двух других источниках) — тем не менее прогоняем через
// transliterateHistoricalCyrillic на всякий случай: в файле встречаются
// редкие вкрапления кириллицы (греч./церк.-слав. цитаты), функция их
// подчистит, а латиницу оставит как есть (нет символов в её CHAR_MAP).
//
// Usage: npx tsx -r dotenv/config scripts/db/import-historical-balkan.ts

import { prismaHistorical } from "@/lib/prisma"
import { parseConllu, ConlluSentence } from "@/lib/historical/conlluParser"
import { transliterateHistoricalCyrillic } from "@/lib/historical/transliteration"
import { execSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

const SOURCE_CORPUS = "clarin_balkan_slavic"
const LICENSE = "CC BY-SA 4.0"
const ZIP_URL = "https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1441/Damaskini.CoNNL-U.zip?sequence=9&isAllowed=y"

function slugifyDocId(newdocId: string): string {
    return newdocId.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()
}

async function downloadAndExtract(): Promise<string> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "damaskini-"))
    const zipPath = path.join(tmpDir, "damaskini.zip")
    console.log("Downloading Damaskini.CoNNL-U.zip from CLARIN.SI...")
    const res = await fetch(ZIP_URL)
    if (!res.ok) throw new Error(`Failed to fetch corpus zip: ${res.status}`)
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
    execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`)

    const found = execSync(`find "${tmpDir}" -name "*.conllu"`).toString().trim().split("\n")[0]
    if (!found) throw new Error("No .conllu file found in downloaded archive")
    return found
}

async function main() {
    const conlluPath = await downloadAndExtract()
    console.log(`Parsing ${conlluPath}...`)
    const raw = fs.readFileSync(conlluPath, "utf-8")
    const allSentences = parseConllu(raw)
    console.log(`  ${allSentences.length} sentences`)

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
    console.log(`\n${byDoc.size} documents, ${allSentences.length} sentences total\n`)

    let docCount = 0
    let tokenCount = 0

    for (const [newdocId, sents] of byDoc) {
        const slug = slugifyDocId(newdocId)

        await prismaHistorical.$transaction(async (tx) => {
            const doc = await tx.historicalDocument.upsert({
                where: { externalId: newdocId },
                create: {
                    slug,
                    title: newdocId,
                    branch: "balkan",
                    period: "15th-19th c.",
                    sourceCorpus: SOURCE_CORPUS,
                    sourceUrl: "https://www.clarin.si/repository/xmlui/handle/11356/1441",
                    license: LICENSE,
                    externalId: newdocId,
                },
                update: {},
            })

            await tx.historicalSentence.deleteMany({ where: { documentSlug: doc.slug } })

            for (let i = 0; i < sents.length; i++) {
                const sent = sents[i]
                const sentence = await tx.historicalSentence.create({
                    data: { documentSlug: doc.slug, position: i, rawText: sent.comments["text"] || "" },
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
    }

    console.log(`Done. Imported ${docCount} documents, ${tokenCount} tokens.`)
    await prismaHistorical.$disconnect()
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
