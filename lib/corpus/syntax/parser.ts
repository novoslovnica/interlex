import { SyntaxToken, DependencyEdge } from './types';
import { chunkNounPhrases } from './npChunker';
import { attachAdpositions } from './prepPhrase';
import { attachClauseRoles, isSimpleClause } from './clause';

/**
 * Разбор одного предложения (токены в порядке появления в предложении,
 * включая пунктуацию). NP-внутренние и предложные рёбра расставляются
 * всегда — они не зависят от структуры клаузы; уровень клаузы (root,
 * nsubj/obj/obl/..., включая сочинение — cc/conj, Фаза 3) — только для
 * предложений без подчинения (см. isSimpleClause). Предложения с
 * придаточными разбирает parseComplexSentence (Фаза 4).
 */
export function parseSentence(tokens: SyntaxToken[]): DependencyEdge[] {
    const { phrases, edges: npEdges } = chunkNounPhrases(tokens);
    const { edges: ppEdges, ppHeadIndices, adpositionIndices } = attachAdpositions(tokens, phrases);
    const edges = [...npEdges, ...ppEdges];

    if (isSimpleClause(tokens)) {
        edges.push(...attachClauseRoles(tokens, phrases, ppHeadIndices, adpositionIndices));
    }

    return dedupeByDepToken(edges);
}

/**
 * Защитная сеть: CorpusDependency.depTokenId уникален (у токена ровно одна
 * голова), а правила парсера в разных модулях расставляются независимо —
 * баг вида "токен получил два ребра" уже случался (см. selectRoot в
 * clause.ts, не исключавший модификаторы, уже поглощённые чужой ИГ) и
 * иначе привёл бы к падению INSERT в persist.ts. Оставляет первое ребро,
 * логирует конфликт — чтобы баг такого рода был виден при разборе/реанализе,
 * а не тихо ронял транзакцию.
 */
export function dedupeByDepToken(edges: DependencyEdge[]): DependencyEdge[] {
    const seen = new Map<string, DependencyEdge>();
    for (const e of edges) {
        const key = String(e.depTokenId);
        if (seen.has(key)) {
            console.warn(`[syntax/parser] duplicate edge for depTokenId=${key}, keeping first (${seen.get(key)!.relation}), dropping ${e.relation}`);
            continue;
        }
        seen.set(key, e);
    }
    return Array.from(seen.values());
}
