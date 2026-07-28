import { MorphoGrammarFeats } from '@/lib/grammar/common';
import { SyntaxToken, DependencyEdge } from './types';
import { normalizeCase } from './caseUtils';
import { baseLemma } from './complexSentence';

/**
 * Экспорт в CoNLL-U (https://universaldependencies.org/format.html) —
 * стандартный формат treebank'ов UD, 10 колонок с табом-разделителем:
 * ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC.
 *
 * UPOS = наш pos как есть (PosType — уже UD-категории). XPOS/DEPS/MISC не
 * заполняем (нет отдельного языкоспецифичного тегсета/расширенного графа) —
 * '_' по спецификации. FEATS собираем из MorphoGrammarFeats с нормализацией
 * значений в канонический UD-регистр (Case=Nom, Number=Sing, ...) — не
 * строгая валидация против полного реестра UD-значений (некоторые времена/
 * наклонения этого проекта не входят в стандартный список UD), а
 * практичный, читаемый внешними инструментами (spaCy conllu-reader и т.п.)
 * экспорт.
 */

function mapCase(v?: string): string | undefined {
    const c = normalizeCase(v);
    return c ? c.charAt(0).toUpperCase() + c.slice(1) : undefined;
}

function mapNumber(v?: string): string | undefined {
    const s = v?.toLowerCase();
    if (s === 'sg' || s === 'sing') return 'Sing';
    if (s === 'pl' || s === 'plur') return 'Plur';
    return undefined;
}

function mapGender(v?: string): string | undefined {
    const s = v?.toLowerCase();
    if (s === 'masc') return 'Masc';
    if (s === 'fem') return 'Fem';
    if (s === 'neut') return 'Neut';
    return undefined;
}

function mapAnimacy(v?: string): string | undefined {
    const s = v?.toLowerCase();
    if (!s) return undefined;
    if (s.startsWith('inan')) return 'Inan';
    if (s === 'anim') return 'Anim';
    return undefined;
}

function mapDegree(v?: string): string | undefined {
    const s = v?.toLowerCase();
    if (s === 'pos') return 'Pos';
    if (s === 'comp' || s === 'cmp') return 'Cmp';
    if (s === 'sup') return 'Sup';
    return undefined;
}

function titleCase(v?: string): string | undefined {
    if (!v) return undefined;
    return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function buildFeats(feats: MorphoGrammarFeats): string {
    const pairs: [string, string][] = [];
    const push = (key: string, val: string | undefined) => { if (val) pairs.push([key, val]); };

    push('Animacy', mapAnimacy(feats.animacy));
    push('Case', mapCase(feats.case));
    push('Degree', mapDegree(feats.degree));
    push('Gender', mapGender(feats.gender));
    push('Mood', titleCase(feats.mood));
    push('Number', mapNumber(feats.number));
    if (feats.person) pairs.push(['Person', feats.person]);
    push('Tense', titleCase(feats.tense));
    push('VerbForm', titleCase(feats.verbForm));
    push('Voice', titleCase(feats.voice));

    if (pairs.length === 0) return '_';
    pairs.sort((a, b) => a[0].localeCompare(b[0])); // UD требует алфавитный порядок ключей FEATS
    return pairs.map(([k, val]) => `${k}=${val}`).join('|');
}

function escapeField(s: string): string {
    return s.replace(/\t/g, ' ').replace(/\n/g, ' ').trim() || '_';
}

export interface ConlluSentenceInput {
    rawText: string;
    tokens: SyntaxToken[];
    edges: DependencyEdge[];
    sentId?: string;
}

export function sentenceToConllU(input: ConlluSentenceInput): string {
    const { rawText, tokens, edges, sentId } = input;
    const idByToken = new Map<string, number>();
    tokens.forEach((t, i) => idByToken.set(String(t.id), i + 1));
    const edgeByDep = new Map(edges.map(e => [String(e.depTokenId), e]));

    const lines: string[] = [];
    if (sentId) lines.push(`# sent_id = ${sentId}`);
    lines.push(`# text = ${escapeField(rawText)}`);

    tokens.forEach((t, i) => {
        const edge = edgeByDep.get(String(t.id));
        const head = edge?.headTokenId != null ? idByToken.get(String(edge.headTokenId)) ?? 0 : 0;
        const deprel = edge?.relation ?? 'dep'; // канонический UD-фолбэк, а не '_' — токен без ребра быть не должно (см. Фазу 2-4), но не роняем экспорт, если случилось

        lines.push([
            String(i + 1),
            escapeField(t.surfaceForm),
            escapeField(baseLemma(t)),
            t.pos || '_',
            '_',
            buildFeats(t.feats),
            String(head),
            deprel,
            '_',
            '_',
        ].join('\t'));
    });

    return lines.join('\n');
}

export function documentToConllU(sentences: ConlluSentenceInput[]): string {
    return sentences.map(sentenceToConllU).join('\n\n') + (sentences.length > 0 ? '\n' : '');
}
