import { PosType, GrammaticalCase, GrammaticalNumber, GrammaticalGender, MorphoGrammarFeats } from '@/lib/grammar/common';

// Кем/чем посчитан score кандидата — см. scoreMatch() в dbAnalyzer.ts.
// 'form_freq': только частотность леммы (Lexeme.corpusFrequencyPerMln) и
// вес падежа (CASE_WEIGHTS); 'context_gov': скорректирован управлением
// предлога слева (см. lib/corpus/syntax/government.ts); 'collocation':
// точное совпадение многословной лексемы — ранжирование не применимо, один
// кандидат; 'flavor'/'synset'/'manual' зарезервированы для следующих фаз
// плана разрешения омонимии.
export type MorphoCandidateSource = 'form_freq' | 'context_gov' | 'flavor' | 'synset' | 'collocation' | 'manual';

// Один вариант омонимии — соответствует строке CorpusTokenCandidate.
// wordSlug/lemma/pos/feats здесь всегда заполнены (в отличие от
// MorphoAnalysis, у которого wordSlug может быть null для нераспознанных
// токенов) — кандидат без леммы не имеет смысла.
export interface MorphoCandidate {
    wordSlug: string;
    lemma: string;
    pos: PosType;
    feats: MorphoGrammarFeats;
    flavor?: string;
    score: number;
    source: MorphoCandidateSource;
}

export interface MorphoAnalysis {
    lemma: string;
    pos: PosType;
    wordSlug: string | null;
    feats: MorphoGrammarFeats;
    matchCount?: number;
    isPartialMatch?: boolean;
    flavor?: string;
    // Полный набор омонимов, из которого выбран текущий wordSlug (первый
    // элемент — текущий победитель). Не хранился до Фазы 1 плана разрешения
    // омонимии — см. CorpusTokenCandidate в prisma/corpus.schema.prisma.
    candidates?: MorphoCandidate[];
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
    matchCount: number;
    feats: MorphoGrammarFeats;
    candidates: MorphoCandidate[];
}