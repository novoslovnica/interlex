import { PosType, MorphoGrammarFeats } from '@/lib/grammar/common';

/**
 * Минимальный набор полей токена, нужный парсеру. Не привязан напрямую к
 * Prisma CorpusToken, чтобы модуль можно было тестировать без БД —
 * маппинг из реальной записи делает вызывающий код (см. lib/corpus/CorpusInjector.ts
 * для аналогичного паттерна маппинга CorpusTokenInput).
 */
export interface SyntaxToken {
    id: string | number | bigint;
    tokenIndex: number;
    surfaceForm: string;
    lemma: string;
    pos: PosType | string;
    feats: MorphoGrammarFeats;
}

/**
 * Уверенность в ребре — светофор по аналогии с DbAnalyzer (green/yellow/red):
 * 'rule' — связь однозначно определена грамматическим правилом (согласование,
 *   проверенное управление и т.п.); 'heuristic' — связь расставлена дефолтным
 *   эвристическим правилом при отсутствии более точных данных (напр. ACC без
 *   записи в VerbGovernment по умолчанию считается obj); 'unresolved' —
 *   правило не сработало, голова — заглушка (root), требуется ручная проверка.
 */
export type DependencyConfidence = 'rule' | 'heuristic' | 'unresolved';

export interface DependencyEdge {
    depTokenId: SyntaxToken['id'];
    headTokenId: SyntaxToken['id'] | null;
    relation: string; // всегда одно из значений UD_DEPREL (см. deprel.ts)
    confidence: DependencyConfidence;
}
