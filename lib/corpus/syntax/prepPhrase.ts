import { PosType } from '@/lib/grammar/common';
import { SyntaxToken, DependencyEdge } from './types';
import { UD_DEPREL } from './deprel';
import { getExpectedCasesForPreposition } from './government';
import { normalizeCase } from './caseUtils';
import { NounPhrase } from './npChunker';

/**
 * Присоединяет предлоги (ADP) к вершине следующей за ними именной группы
 * как deprel 'case' — это соответствует конвенции UD (сам предлог —
 * зависимое, а не голова; см. https://universaldependencies.org/u/dep/case.html).
 * Использует уже готовую таблицу PREPOSITION_GOVERNMENT (lib/corpus/syntax/government.ts).
 *
 * Ищем по surfaceForm, не по lemma: найдено при верификации Фазы 4, что
 * CorpusToken.lemma для предлога, попавшего в распознанную коллокацию
 * (lib/corpus/tokenizer/collocationMatcher.ts), — это лемма ВСЕЙ фразы,
 * не самого предлога (напр. предлог "s" внутри "sgodno s" получает
 * lemma="sgodno s", "na" внутри "s obzirom na" — lemma="s obzirom na").
 * Предлоги — замкнутый неизменяемый класс, surfaceForm совпадает с
 * "леммой" по определению (в отличие от изменяемых частей речи, где
 * surfaceForm пришлось бы обратно лемматизировать).
 */
export function attachAdpositions(
    tokens: SyntaxToken[],
    phrases: NounPhrase[]
): { edges: DependencyEdge[]; ppHeadIndices: Set<number>; adpositionIndices: Set<number> } {
    const edges: DependencyEdge[] = [];
    const ppHeadIndices = new Set<number>();
    const adpositionIndices = new Set<number>();

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].pos !== PosType.ADP) continue;

        const expectedCases = getExpectedCasesForPreposition(tokens[i].surfaceForm);
        if (expectedCases.length === 0) continue;

        // Ближайшая ИГ, начинающаяся сразу за предлогом (сам предлог или,
        // если у ИГ есть свои модификаторы, первый из них — на позиции i+1)
        const phrase = phrases.find(
            p => p.headIndex > i && (p.modifierIndices.length === 0 ? p.headIndex === i + 1 : p.modifierIndices[0] === i + 1)
        );
        if (!phrase) continue;

        const head = tokens[phrase.headIndex];
        const headCase = normalizeCase(head.feats.case);
        if (!headCase || !expectedCases.includes(headCase)) continue;

        edges.push({
            depTokenId: tokens[i].id,
            headTokenId: head.id,
            relation: UD_DEPREL.CASE,
            confidence: 'rule',
        });
        ppHeadIndices.add(phrase.headIndex);
        adpositionIndices.add(i);
    }

    return { edges, ppHeadIndices, adpositionIndices };
}
