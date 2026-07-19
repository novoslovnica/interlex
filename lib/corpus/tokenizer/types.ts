import { PosType, GrammaticalCase, GrammaticalNumber, GrammaticalGender, MorphoGrammarFeats } from '@/lib/grammar/common';

export interface MorphoAnalysis {
    lemma: string;
    pos: PosType;
    wordSlug: string | null;
    feats: MorphoGrammarFeats;
    matchCount?: number;
    isPartialMatch?: boolean;
}

export interface TokenPayload {
    surfaceForm: string;
    isPunctuation: boolean;
    analysis: MorphoAnalysis;
}

export interface TokenizerResult {
    segments: SegmentPayload[];
    sentences: SentencePayload[];
    tokens: TokenPayload[];
}

export interface SegmentPayload {
    id: string;
    documentSlug: string;
    position: number;
    rawText: string;
}

export interface SentencePayload {
    id: string;
    documentSlug: string;
    segmentId: string;
    position: number;
    rawText: string;
}

export interface CorpusTokenInput {
    documentSlug: string;
    sentenceId: string;
    tokenIndex: number;
    wordIndex: number;
    surfaceForm: string;
    lemma: string;
    pos: string;
    wordSlug: string | null;
    feats: MorphoGrammarFeats;
}