import { PosType } from '@/lib/grammar/common';
import { TokenPayload, TokenizerResult, SentencePayload, CorpusTokenInput, SegmentPayload, MorphoAnalysis } from './types';
import { analyzeWord } from './morphology';
import { DbAnalyzer } from './dbAnalyzer';
import { CollocationMatcher } from './collocationMatcher';

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
        analyzer?: DbAnalyzer,
        collocationMatcher?: CollocationMatcher
    ): Promise<TokenPayload[]> {
        const rawTokens = sentenceText.match(TOKEN_PATTERN) || [];
        const results: TokenPayload[] = [];

        let i = 0;
        while (i < rawTokens.length) {
            const t = rawTokens[i];
            const isPunct = PUNCTUATION_TEST.test(t);

            // Жадный проход по фразам: до 4 идущих подряд токенов, точное
            // совпадение с многословной лексемой (см. collocationMatcher.ts).
            // Без него такие лексемы никогда не находятся по-токенному
            // анализатором ниже.
            if (!isPunct && collocationMatcher) {
                const match = collocationMatcher.matchAt(rawTokens, i);
                if (match) {
                    const analysis: MorphoAnalysis = {
                        lemma: match.record.lemma,
                        pos: match.record.pos as PosType,
                        wordSlug: match.record.wordSlug,
                        feats: {},
                        matchCount: 1,
                    };
                    for (let k = 0; k < match.length; k++) {
                        results.push({ surfaceForm: rawTokens[i + k], isPunctuation: false, analysis });
                    }
                    i += match.length;
                    continue;
                }
            }

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
            i++;
        }

        return results;
    }

    public static async tokenizeDocument(
        documentSlug: string,
        rawText: string,
        idGenerator: () => string,
        analyzer?: DbAnalyzer,
        collocationMatcher?: CollocationMatcher
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

                const sentenceTokens = await this.tokenizeSentence(sentenceText, analyzer, collocationMatcher);

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
                        matchCount: t.analysis.matchCount ?? 0,
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