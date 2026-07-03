import { PosType } from '@/lib/grammar/common';
import { TokenPayload, TokenizerResult, SentencePayload, CorpusTokenInput } from './types';
import { analyzeWord } from './morphology';
import { DbAnalyzer } from './dbAnalyzer';

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const TOKEN_PATTERN = /[\wа-яёѕєіјљњћџѫѭѣžčšěŽČŠĚ]+|[^\s\wа-яёѕєіјљњћџѫѭѣžčšěŽČŠĚ]+/gi;
const PUNCTUATION_TEST = /^[^\wа-яёѕєіјљњћџѫѭѣžčšěŽČŠĚ]+$/;

export class Tokenizer {
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
    ): Promise<{ sentences: SentencePayload[]; tokenInputs: CorpusTokenInput[] }> {
        const rawSentences = this.splitSentences(rawText);

        const sentences: SentencePayload[] = [];
        const tokenInputs: CorpusTokenInput[] = [];

        let globalTokenIndex = 0;
        let globalWordIndex = 0;

        for (let sIdx = 0; sIdx < rawSentences.length; sIdx++) {
            const sentenceText = rawSentences[sIdx];
            const sentenceId = idGenerator();

            sentences.push({
                id: sentenceId,
                documentSlug,
                position: sIdx,
                rawText: sentenceText,
            });

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

        return { sentences, tokenInputs };
    }
}