import { PosType } from '@/lib/grammar/common';
import { SyntaxToken, DependencyEdge } from './types';
import { UD_DEPREL } from './deprel';
import { parseSentence, dedupeByDepToken } from './parser';

/**
 * ВАЖНО, найдено при верификации Фазы 4 на реальных данных: в словаре
 * interlex.db НЕТ НИ ОДНОЙ лексемы с pos='SCONJ' — все союзы, включая
 * однозначно подчинительные по функции (dabi/aby "чтобы", da "что/чтобы",
 * kȯgda/kȯgdy "когда", poka/dokole/dopoka "пока", jestli "если", ze
 * "что/потому что", hoti/hot и acekoli/ace "хотя"), помечены как CCONJ
 * (подтверждено прямым запросом к interlex.db — 59 строк pos='CCONJ',
 * 0 строк pos='SCONJ'). Соответственно ни один токен в corpus.db никогда
 * не получает pos=SCONJ (подтверждено на 10594 предложениях, 300
 * документов — 0 вхождений). Проверка t.pos === PosType.SCONJ поэтому
 * никогда бы не сработала на реальном корпусе.
 *
 * Это не решение Фазы 4 — правильный фикс лежит выше по пайплайну
 * (переразметить словарь: развести CCONJ на настоящие CCONJ/SCONJ по
 * общеслав. грамматике, затем реанализировать корпус) и специально не
 * делается здесь: это правка живых лексических данных interlex.db,
 * требующая lib/audit-log.ts, бэкапа и, по конвенции проекта видимой в
 * AGENTS.md (см. VerbGovernment в prisma/corpus.schema.prisma), — лингвиста,
 * подтверждающего каждую из ~59 записей, а не однократной правки походя.
 * Здесь — только точечный, консервативный список ЛЕММ (не весь список
 * CCONJ, только однозначно подчинительные по общеславянской грамматике,
 * без спорных/контекстно-зависимых случаев вроде "ako"/"li"/"koliko"),
 * которым помечается граница клаузы независимо от POS-тега — тот же приём,
 * что и с sę/se (expl) в clause.ts.
 */
const SUBORDINATOR_LEMMAS = new Set(['dabi', 'aby', 'da', 'kȯgda', 'kȯgdy', 'poka', 'dokole', 'dopoka', 'jestli', 'hoti', 'hot', 'acekoli', 'ace', 'ze']);

/** Изъяснительное "что" (ze) — единственный надёжно классифицируемый по функции подтип (ccomp), остальные — advcl (см. комментарий у SUBORDINATOR_LEMMAS). */
const COMPLEMENT_SCONJ_LEMMAS = new Set(['ze']);

/**
 * "ktory" и его производные существуют в словаре ДВАЖДЫ — как ADJ (id 1359)
 * и как PRON (id 10481, вместе с ktorykoli/ktory-libo/ktory-nebud/kto/
 * ktokoli/kto-nebud) — тот же класс омонимии, что и разбор по dedup в
 * /admin/deduplication. Токенизатор может присвоить любой из двух тегов в
 * зависимости от того, какая словарная запись совпала первой — поэтому
 * распознаём по лемме, а не только по pos=PRON (иначе теряем примерно
 * половину реальных относительных придаточных).
 */
const RELATIVE_PRONOUN_LEMMAS = new Set(['ktory', 'ktorykoli', 'ktory-libo', 'ktory-nebud', 'kto', 'ktokoli', 'kto-nebud']);

/**
 * CorpusToken.lemma в реальных данных — это slug лексемы, а не голая
 * лемма: при омонимии между частями речи (см. RELATIVE_PRONOUN_LEMMAS)
 * словарь дизамбигуирует суффиксом "-{POS}" ("ze-CCONJ", "ktory-adj",
 * регистр суффикса не унифицирован). У неомонимичных слов суффикса может
 * не быть вовсе ("togo", "slěduje" — оба без суффикса в реальных данных).
 * Снимаем суффикс, только если он совпадает с собственным pos токена —
 * так не портим леммы с настоящим внутренним дефисом ("kto-nebud").
 */
export function baseLemma(t: SyntaxToken): string {
    const lemma = t.lemma ?? '';
    const idx = lemma.lastIndexOf('-');
    if (idx === -1) return lemma.toLowerCase();
    const suffix = lemma.slice(idx + 1);
    if (suffix.toUpperCase() === String(t.pos).toUpperCase()) return lemma.slice(0, idx).toLowerCase();
    return lemma.toLowerCase();
}

interface Boundary {
    index: number; // индекс токена начала клаузы (для 'sconj' — сам союз; для 'relative' — само местоимение)
    kind: 'sconj' | 'relative';
}

/**
 * Границы придаточных клауз:
 *  - каждый SCONJ начинает новую клаузу (mark);
 *  - PRON сразу после запятой, при условии что до следующей уже найденной
 *    границы (или до конца предложения) в этом промежутке есть VERB —
 *    признак относительного придаточного (acl). Требование "есть VERB"
 *    отсекает случайные "запятая + местоимение", не являющиеся клаузой
 *    (напр. однородные члены/приложения) — без словаря относительных
 *    местоимений (ktory/kto/čto/koj/...), т.е. по структуре, а не по лексике.
 */
function isSubordinatorToken(t: SyntaxToken): boolean {
    if (t.pos === PosType.SCONJ) return true; // на случай будущей переразметки словаря (см. комментарий у SUBORDINATOR_LEMMAS)
    if (t.pos !== PosType.CCONJ) return false; // сегодня в реальных данных все союзы — CCONJ
    return SUBORDINATOR_LEMMAS.has(baseLemma(t));
}

function isRelativePronounToken(t: SyntaxToken): boolean {
    if (t.pos !== PosType.PRON && t.pos !== PosType.ADJ) return false; // "ktory" встречается под обоими тегами (омонимия в словаре)
    return RELATIVE_PRONOUN_LEMMAS.has(baseLemma(t));
}

function findBoundaries(tokens: SyntaxToken[]): Boundary[] {
    const boundaries: Boundary[] = [];

    for (let i = 0; i < tokens.length; i++) {
        if (isSubordinatorToken(tokens[i])) boundaries.push({ index: i, kind: 'sconj' });
    }

    for (let i = 1; i < tokens.length; i++) {
        if (!isRelativePronounToken(tokens[i])) continue;
        if (tokens[i - 1].surfaceForm !== ',') continue;
        if (boundaries.some(b => b.index === i)) continue;

        const nextKnown = boundaries.map(b => b.index).filter(idx => idx > i).sort((a, b) => a - b)[0] ?? tokens.length;
        const hasVerb = tokens.slice(i, nextKnown).some(t => t.pos === PosType.VERB);
        if (hasVerb) boundaries.push({ index: i, kind: 'relative' });
    }

    return boundaries.sort((a, b) => a.index - b.index);
}

function findRootTokenId(edges: DependencyEdge[]): SyntaxToken['id'] | undefined {
    return edges.find(e => e.headTokenId === null)?.depTokenId;
}

function findAntecedent(tokens: SyntaxToken[], relIndex: number): SyntaxToken['id'] | undefined {
    for (let i = relIndex - 1; i >= 0; i--) {
        if (tokens[i].pos === PosType.NOUN || tokens[i].pos === PosType.PROPN) return tokens[i].id;
    }
    return undefined;
}

/**
 * Разбор сложного предложения (с подчинением). Не рекурсивно по глубине —
 * все найденные придаточные присоединяются к корню ГЛАВНОЙ клаузы (первый
 * сегмент до первой границы), а не друг к другу цепочкой — вложенное
 * подчинение (придаточное внутри придаточного) в Фазе 4 не моделируется,
 * все найденные клаузы трактуются как сёстры под главной. Известное
 * ограничение MVP, см. отчёт по Фазе 4.
 */
export function parseComplexSentence(tokens: SyntaxToken[]): DependencyEdge[] {
    const boundaries = findBoundaries(tokens);
    if (boundaries.length === 0) return parseSentence(tokens); // ни одного подчинительного маркера — обычная (простая или сочинённая) клауза, Фаза 2/3

    const mainTokens = tokens.slice(0, boundaries[0].index);
    const mainEdges = parseSentence(mainTokens);
    const matrixRootId = findRootTokenId(mainEdges);

    const edges: DependencyEdge[] = [...mainEdges];
    if (matrixRootId === undefined) return dedupeByDepToken(edges); // без сказуемого в главной клаузе — присоединять некуда

    for (let k = 0; k < boundaries.length; k++) {
        const b = boundaries[k];
        const segEnd = k + 1 < boundaries.length ? boundaries[k + 1].index : tokens.length;

        if (b.kind === 'sconj') {
            const markToken = tokens[b.index];
            const content = tokens.slice(b.index + 1, segEnd);
            const subEdges = parseSentence(content);
            const subRootId = findRootTokenId(subEdges);

            if (subRootId !== undefined) {
                edges.push(...subEdges.filter(e => !(e.depTokenId === subRootId && e.headTokenId === null)));
                const relation = COMPLEMENT_SCONJ_LEMMAS.has(markToken.lemma.toLowerCase()) ? UD_DEPREL.CCOMP : UD_DEPREL.ADVCL;
                edges.push({ depTokenId: subRootId, headTokenId: matrixRootId, relation, confidence: 'heuristic' });
                edges.push({ depTokenId: markToken.id, headTokenId: subRootId, relation: UD_DEPREL.MARK, confidence: 'rule' });
            } else {
                edges.push(...subEdges);
                edges.push({ depTokenId: markToken.id, headTokenId: matrixRootId, relation: UD_DEPREL.DEP, confidence: 'unresolved' });
            }
        } else {
            const content = tokens.slice(b.index, segEnd);
            const subEdges = parseSentence(content);
            const subRootId = findRootTokenId(subEdges);
            const antecedent = findAntecedent(tokens, b.index);

            if (subRootId !== undefined && antecedent !== undefined) {
                edges.push(...subEdges.filter(e => !(e.depTokenId === subRootId && e.headTokenId === null)));
                edges.push({ depTokenId: subRootId, headTokenId: antecedent, relation: UD_DEPREL.ACL, confidence: 'heuristic' });
            } else {
                edges.push(...subEdges); // нет антецедента — оставляем локальный root клаузы как есть, не теряем разбор
            }
        }
    }

    return dedupeByDepToken(edges);
}
