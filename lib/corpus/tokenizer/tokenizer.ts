import { PosType } from '@/lib/grammar/common';
import { TokenPayload, TokenizerResult, SentencePayload, CorpusTokenInput, SegmentPayload } from './types';
import { analyzeWord } from './morphology';
import { DbAnalyzer } from './dbAnalyzer';

const SEGMENT_SPLIT = /\n\s*\n/;
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const TOKEN_PATTERN = /[\wа-яёѕєіјљњћџѫѭѣžčšěŽČŠĚ]+|[^\s\wа-яёѕєіјљњћџѫѭѣžčšěŽČŠĚ]+/gi;
const PUNCTUATION_TEST = /^[^\wа-яёѕєіјљњћџѫѭѣžčšěŽČŠĚ]+$/;

export class Tokenizer {
    public static splitIntoSegments(rawText: string): string[] {
        return rawText
            .split(SEGMENT_SPLIT)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    public static splitSentences(rawText: string): string[] {
        return rawText
            .split(SENTENCE_SPLIT)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    public static async tokenizeSentence(
        sentenceText: string,
        analyzer?: DbAnalyzer
    ): Promise<TokenPayload[]> {
        const rawTokens = sentenceText.match(TOKEN_PATTERN) || [];
        const results: TokenPayload[] = [];

        for (const t of rawTokens) {
            const isPunct = PUNCTUATION_TEST.test(t);
            let analysis;

            if (isPunct) {
                analysis = { lemma: t, pos: PosType.PUNCT, wordSlug: null, feats: {} };
            } else if (analyzer) {
                const dbResult = await analyzer.analyzeWord(t);
                analysis = dbResult ?? analyzeWord(t);
            } else {
                analysis = analyzeWord(t);
            }

            results.push({
                surfaceForm: t,
                isPunctuation: isPunct,
                analysis,
            });
        }

        return results;
    }

    public static async tokenizeDocument(
        documentSlug: string,
        rawText: string,
        idGenerator: () => string,
        analyzer?: DbAnalyzer
    ): Promise<{ segments: SegmentPayload[]; sentences: SentencePayload[]; tokenInputs: CorpusTokenInput[] }> {
        const rawSegments = this.splitIntoSegments(rawText);

        const segments: SegmentPayload[] = [];
        const sentences: SentencePayload[] = [];
        const tokenInputs: CorpusTokenInput[] = [];

        let globalTokenIndex = 0;
        let globalWordIndex = 0;
        let globalSentenceIdx = 0;

        for (let segIdx = 0; segIdx < rawSegments.length; segIdx++) {
            const segmentText = rawSegments[segIdx];
            const segmentId = idGenerator();

            segments.push({
                id: segmentId,
                documentSlug,
                position: segIdx,
                rawText: segmentText,
            });

            const rawSentences = this.splitSentences(segmentText);

            for (const sentenceText of rawSentences) {
                const sentenceId = idGenerator();

                sentences.push({
                    id: sentenceId,
                    documentSlug,
                    segmentId,
                    position: globalSentenceIdx,
                    rawText: sentenceText,
                });
                globalSentenceIdx++;

                const sentenceTokens = await this.tokenizeSentence(sentenceText, analyzer);

                for (const t of sentenceTokens) {
                    tokenInputs.push({
                        documentSlug,
                        sentenceId,
                        tokenIndex: globalTokenIndex,
                        wordIndex: t.isPunctuation ? -1 : globalWordIndex,
                        surfaceForm: t.surfaceForm,
                        lemma: t.analysis.lemma,
                        pos: t.analysis.pos,
                        wordSlug: t.analysis.wordSlug,
                        feats: t.analysis.feats,
                    });

                    globalTokenIndex++;
                    if (!t.isPunctuation) {
                        globalWordIndex++;
                    }
                }
            }
        }

        return { segments, sentences, tokenInputs };
    }
}