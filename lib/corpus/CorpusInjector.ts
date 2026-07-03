import { Prisma, PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Tokenizer } from './tokenizer';
import { CorpusTokenInput } from './tokenizer/types';
import { DbAnalyzer } from './tokenizer/dbAnalyzer';

const prisma = new PrismaClient();

const analyzer = new DbAnalyzer(
    (bases) =>
        prisma.word.findMany({
            where: { base: { in: bases, not: null } },
            select: {
                id: true,
                slug: true,
                isv: true,
                pos: true,
                protoStemClass: true,
                stemExtension: true,
                paradigm: true,
                base: true,
                gender: true,
                alternationType: true,
                fleetingVowelAt: true,
            },
        })
);

export class CorpusInjector {
    public async injectDocument(payload: {
        title: string;
        slug: string;
        rawText: string;
        author?: string;
        language?: string;
    }): Promise<{ success: boolean; tokensProcessed: number }> {
        const { title, slug, rawText, author, language = 'is' } = payload;

        const { sentences, tokenInputs } = await Tokenizer.tokenizeDocument(slug, rawText, uuidv4, analyzer);

        const sentencesToDb: Prisma.CorpusSentenceCreateManyInput[] = sentences.map(s => ({
            id: s.id,
            documentSlug: slug,
            position: s.position,
            rawText: s.rawText,
        }));

        const tokensToDb: Prisma.CorpusTokenCreateManyInput[] = tokenInputs.map((t: CorpusTokenInput) => ({
            documentSlug: slug,
            sentenceId: t.sentenceId,
            tokenIndex: t.tokenIndex,
            wordIndex: t.wordIndex,
            surfaceForm: t.surfaceForm,
            lemma: t.lemma,
            pos: t.pos,
            wordSlug: t.wordSlug,
            feats: t.feats as Prisma.InputJsonValue,
        }));

        try {
            await prisma.$transaction(async (tx) => {
                await tx.corpusDocument.create({
                    data: { title, slug, rawText, author, language },
                });

                await tx.corpusSentence.createMany({
                    data: sentencesToDb,
                });

                const chunkSize = 5000;
                for (let i = 0; i < tokensToDb.length; i += chunkSize) {
                    const chunk = tokensToDb.slice(i, i + chunkSize);
                    await tx.corpusToken.createMany({
                        data: chunk,
                    });
                }
            });

            return { success: true, tokensProcessed: tokenInputs.length };
        } catch (error) {
            console.error('Failed to inject corpus document:', error);
            throw error;
        }
    }
}