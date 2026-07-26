import { randomUUID } from "crypto"
import { prismaCorpus } from "@/lib/prisma"
import { Tokenizer } from "@/lib/corpus/tokenizer/tokenizer"
import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CorpusTokenInput } from "@/lib/corpus/tokenizer/types"

export interface UpsertDocumentPayload {
    title: string
    slug: string
    rawText: string
    author?: string
    language?: string
    genre?: string
    /** Стабильный тег источника, напр. "iswiki:2034" — не меняется при переименовании страницы */
    externalId?: string
    sourceUrl?: string
    /** ID ревизии источника (напр. MediaWiki revid) — если не изменился с прошлого запуска, документ пропускается */
    sourceRevisionId?: number
}

export type UpsertDocumentResult =
    | { status: "skipped"; slug: string }
    | { status: "created" | "updated"; slug: string; tokensProcessed: number }

/**
 * Создаёт или обновляет документ корпуса по externalId (если задан) или slug.
 * При обновлении старые segments/sentences/tokens документа удаляются и
 * пересоздаются в одной транзакции — записи не накапливаются при повторных запусках.
 * Если sourceRevisionId совпадает с уже сохранённым, работа пропускается целиком.
 */
export async function upsertCorpusDocument(
    payload: UpsertDocumentPayload,
    analyzer: DbAnalyzer,
): Promise<UpsertDocumentResult> {
    const { title, rawText, author, language = "is", genre } = payload

    const existing = payload.externalId
        ? await prismaCorpus.corpusDocument.findUnique({ where: { externalId: payload.externalId } })
        : await prismaCorpus.corpusDocument.findUnique({ where: { slug: payload.slug } })

    if (
        existing &&
        payload.sourceRevisionId !== undefined &&
        existing.sourceRevisionId === payload.sourceRevisionId
    ) {
        return { status: "skipped", slug: existing.slug }
    }

    const slug = existing?.slug ?? payload.slug

    const { segments, sentences, tokenInputs } = await Tokenizer.tokenizeDocument(slug, rawText, randomUUID, analyzer)

    const maxIdResult = await prismaCorpus.corpusToken.findFirst({ orderBy: { id: "desc" }, select: { id: true } })
    let nextTokenId = maxIdResult ? Number(maxIdResult.id) + 1 : 1

    await prismaCorpus.$transaction(async (tx) => {
        if (existing) {
            await tx.corpusToken.deleteMany({ where: { documentSlug: slug } })
            await tx.corpusSentence.deleteMany({ where: { documentSlug: slug } })
            await tx.corpusSegment.deleteMany({ where: { documentSlug: slug } })

            await tx.corpusDocument.update({
                where: { slug },
                data: {
                    title,
                    rawText,
                    author,
                    language,
                    ...(genre ? { genre } : {}),
                    sourceUrl: payload.sourceUrl,
                    externalId: payload.externalId,
                    sourceRevisionId: payload.sourceRevisionId,
                    candidatesProcessed: false,
                },
            })
        } else {
            await tx.corpusDocument.create({
                data: {
                    title,
                    slug,
                    rawText,
                    author,
                    language,
                    ...(genre ? { genre } : {}),
                    sourceUrl: payload.sourceUrl,
                    externalId: payload.externalId,
                    sourceRevisionId: payload.sourceRevisionId,
                },
            })
        }

        await tx.corpusSegment.createMany({
            data: segments.map((s) => ({
                id: s.id,
                documentSlug: slug,
                position: s.position,
                rawText: s.rawText,
            })),
        })

        await tx.corpusSentence.createMany({
            data: sentences.map((s) => ({
                id: s.id,
                documentSlug: slug,
                segmentId: s.segmentId,
                position: s.position,
                rawText: s.rawText,
            })),
        })

        const chunkSize = 5000
        for (let i = 0; i < tokenInputs.length; i += chunkSize) {
            const chunk = tokenInputs.slice(i, i + chunkSize)
            await tx.corpusToken.createMany({
                data: chunk.map((t: CorpusTokenInput) => ({
                    id: BigInt(nextTokenId++),
                    documentSlug: slug,
                    sentenceId: t.sentenceId,
                    tokenIndex: t.tokenIndex,
                    wordIndex: t.wordIndex,
                    surfaceForm: t.surfaceForm,
                    lemma: t.lemma,
                    pos: t.pos,
                    wordSlug: t.wordSlug,
                    matchCount: t.matchCount,
                    feats: t.feats as Record<string, string>,
                })),
            })
        }
    })

    return { status: existing ? "updated" : "created", slug, tokensProcessed: tokenInputs.length }
}
