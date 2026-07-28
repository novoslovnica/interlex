import { GrammaticalCase, PosType } from '@/lib/grammar/common';
import { SyntaxToken, DependencyEdge, DependencyConfidence } from './types';
import { UD_DEPREL } from './deprel';
import { getVerbGovernment, VerbGovernmentRole } from './government';
import { normalizeCase } from './caseUtils';
import { NounPhrase } from './npChunker';
import { localPredicateFor, findNominalCoordinationTarget } from './coordination';

/**
 * Возвратная частица sę/se — сравниваем по surfaceForm, не по lemma:
 * найдено при верификации Фазы 4, что в реальных данных "sę" получает
 * pos=PRON (не PART) с lemma="se-PRON", а написание без диакритики "se"
 * вообще не распознаётся анализатором (pos=X, lemma — случайное
 * совпадение с несвязанным словом). surfaceForm — простое и надёжное
 * сравнение для этой замкнутой, несклоняемой частицы, независимо от того,
 * как её протегировал анализатор выше по пайплайну.
 */
const REFLEXIVE_SURFACE_FORMS = new Set(['sę', 'se']);

/**
 * true, если в предложении нет подчинительного союза — то есть это одна
 * клауза (возможно, с сочинением сказуемых/аргументов, см. Фазу 3) без
 * придаточных. Предложения со SCONJ разбирает Фаза 4 (разбивает на клаузы
 * и вызывает attachClauseRoles на каждой по отдельности).
 */
export function isSimpleClause(tokens: SyntaxToken[]): boolean {
    return !tokens.some(t => t.pos === PosType.SCONJ);
}

function relationForRole(role: VerbGovernmentRole): string {
    switch (role) {
        case 'obj': return UD_DEPREL.OBJ;
        case 'iobj': return UD_DEPREL.IOBJ;
        case 'obl': return UD_DEPREL.OBL;
    }
}

interface RootSelection {
    index: number;
    confidence: DependencyConfidence;
}

/**
 * Выбор главного сказуемого клаузы (root):
 *  - есть VERB — первый VERB в порядке токенов (остальные VERB, если есть,
 *    — сочинённые конъюнкты, см. attachPredicateChain ниже, поэтому
 *    уверенность 'rule' независимо от их числа: Фаза 3 корректно
 *    моделирует сочинение, а не игнорирует лишние глаголы, как раньше);
 *  - VERB нет, но есть AUX — именное сказуемое: первый ADJ/NOUN/PROPN
 *    после AUX (типичный порядок "подлежащее — связка — сказуемое"),
 *    иначе тот же поиск по всему предложению;
 *  - нет ни VERB, ни AUX — назывное предложение, первый ADJ/NOUN/PROPN,
 *    иначе — первый непунктуационный токен.
 *
 * Кандидаты, уже поглощённые chunkNounPhrases как модификатор чужой ИГ
 * (`consumed`), исключаются — иначе токен получил бы два ребра сразу
 * (amod к своей вершине И root), что нарушает UNIQUE(depTokenId) в
 * CorpusDependency. Найдено при верификации Фазы 3 на "Nečista obuvka..." —
 * "Nečista" был одновременно amod→obuvka и (ошибочно) root.
 */
function selectRoot(tokens: SyntaxToken[], predicateIndices: number[], consumed: Set<number>): RootSelection | null {
    if (predicateIndices.length > 0) {
        return { index: predicateIndices[0], confidence: 'rule' };
    }

    const auxIndices: number[] = [];
    tokens.forEach((t, i) => { if (t.pos === PosType.AUX) auxIndices.push(i); });

    const isPredicateCandidate = (t: SyntaxToken, i: number) =>
        (t.pos === PosType.ADJ || t.pos === PosType.NOUN || t.pos === PosType.PROPN) && !auxIndices.includes(i) && !consumed.has(i);

    if (auxIndices.length > 0) {
        const auxIdx = auxIndices[0];
        const afterAux = tokens.findIndex((t, i) => i > auxIdx && isPredicateCandidate(t, i));
        if (afterAux >= 0) return { index: afterAux, confidence: 'rule' };

        const anywhere = tokens.findIndex((t, i) => isPredicateCandidate(t, i));
        if (anywhere >= 0) return { index: anywhere, confidence: 'heuristic' };

        return { index: auxIdx, confidence: 'heuristic' };
    }

    const nominal = tokens.findIndex((t, i) => isPredicateCandidate(t, i));
    if (nominal >= 0) return { index: nominal, confidence: 'heuristic' };

    const firstContent = tokens.findIndex((t, i) => t.pos !== PosType.PUNCT && !consumed.has(i));
    return firstContent >= 0 ? { index: firstContent, confidence: 'heuristic' } : null;
}

function nearestPrecedingNominal(phrases: NounPhrase[], beforeIndex: number, excludeIndex: number): NounPhrase | undefined {
    return [...phrases]
        .filter(q => q.headIndex < beforeIndex && q.headIndex !== excludeIndex)
        .sort((a, b) => b.headIndex - a.headIndex)[0];
}

/**
 * Сочинённые сказуемые ("dobyla kompleks, razvalila jego i sožegla"):
 * каждый следующий VERB в цепочке — conj к первому (root), по конвенции
 * UD (последующие конъюнкты присоединяются к первому, а не цепочкой друг
 * к другу). CCONJ непосредственно перед конъюнктом — cc к нему; бессоюзная
 * (через запятую) связь между конъюнктами тоже распознаётся — в реальном
 * корпусе она встречается не реже союзной.
 */
function attachPredicateChain(tokens: SyntaxToken[], predicateIndices: number[], edges: DependencyEdge[], consumed: Set<number>): void {
    if (predicateIndices.length === 0) return;
    const rootIdx = predicateIndices[0];

    for (const idx of predicateIndices.slice(1)) {
        edges.push({ depTokenId: tokens[idx].id, headTokenId: tokens[rootIdx].id, relation: UD_DEPREL.CONJ, confidence: 'heuristic' });
        consumed.add(idx);

        if (idx - 1 >= 0 && tokens[idx - 1].pos === PosType.CCONJ) {
            edges.push({ depTokenId: tokens[idx - 1].id, headTokenId: tokens[idx].id, relation: UD_DEPREL.CC, confidence: 'rule' });
            consumed.add(idx - 1);
        }
    }
}

export function attachClauseRoles(
    tokens: SyntaxToken[],
    phrases: NounPhrase[],
    ppHeadIndices: Set<number>,
    adpositionIndices: Set<number> = new Set()
): DependencyEdge[] {
    const edges: DependencyEdge[] = [];
    const consumed = new Set<number>();
    for (const p of phrases) for (const m of p.modifierIndices) consumed.add(m);
    // Предлоги, уже присоединённые attachAdpositions как 'case', иначе
    // выглядят "непоглощёнными" для этой функции и получают второе
    // (отбрасываемое дедупом, но лишнее) ребро в общем fallback-цикле ниже —
    // найдено при верификации Фазы 4 (939 ложных предупреждений о дубликатах
    // на 10594 предложениях после починки поиска предлогов по surfaceForm
    // в prepPhrase.ts, который стал находить куда больше настоящих 'case').
    for (const idx of adpositionIndices) consumed.add(idx);

    const predicateIndices: number[] = [];
    tokens.forEach((t, i) => { if (t.pos === PosType.VERB) predicateIndices.push(i); });

    const rootSel = selectRoot(tokens, predicateIndices, consumed);
    if (!rootSel) return edges;

    const rootIdx = rootSel.index;
    const rootToken = tokens[rootIdx];
    const rootIsVerbal = rootToken.pos === PosType.VERB || rootToken.pos === PosType.AUX;
    consumed.add(rootIdx);

    edges.push({ depTokenId: rootToken.id, headTokenId: null, relation: UD_DEPREL.ROOT, confidence: rootSel.confidence });

    attachPredicateChain(tokens, predicateIndices, edges, consumed);

    // Локальная цель присоединения для индекса токена: ближайшее
    // предшествующее сказуемое цепочки (сочинение, Фаза 3), либо
    // единственный root, если цепочки нет (именное сказуемое/AUX).
    const localTarget = (index: number): number =>
        predicateIndices.length > 0 ? localPredicateFor(index, predicateIndices) : rootIdx;

    // Вспомогательные глаголы — 'aux' при глагольном локальном сказуемом,
    // 'cop' при именном (единственный root в этой ветке, т.к. цепочка
    // сочинённых копул в Фазе 3 не моделируется — известное ограничение)
    tokens.forEach((t, i) => {
        if (t.pos !== PosType.AUX || i === rootIdx) return;
        const target = localTarget(i);
        edges.push({
            depTokenId: t.id,
            headTokenId: tokens[target].id,
            relation: rootIsVerbal ? UD_DEPREL.AUX : UD_DEPREL.COP,
            confidence: 'rule',
        });
        consumed.add(i);
    });

    const subjectAssignedFor = new Set<number>();
    const processedPhraseHeads = new Set<number>();

    for (const p of phrases) {
        if (p.headIndex === rootIdx || predicateIndices.includes(p.headIndex)) continue;
        const head = tokens[p.headIndex];
        const c = normalizeCase(head.feats.case);
        const target = localTarget(p.headIndex);
        const targetToken = tokens[target];
        const targetIsVerbal = targetToken.pos === PosType.VERB || targetToken.pos === PosType.AUX;

        if (REFLEXIVE_SURFACE_FORMS.has(head.surfaceForm.toLowerCase())) {
            // sę/se реально тегируется как PRON (не PART) — попадает сюда,
            // в основной цикл ролей, а не в fallback ниже; перехватываем
            // раньше падежной логики, иначе получит ложный nsubj/obj/dep
            edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: UD_DEPREL.EXPL, confidence: 'rule' });
            processedPhraseHeads.add(p.headIndex);
            continue;
        }

        const coordTarget = findNominalCoordinationTarget(tokens, phrases, p, processedPhraseHeads);
        if (coordTarget) {
            edges.push({ depTokenId: head.id, headTokenId: tokens[coordTarget.headTokenIndex].id, relation: UD_DEPREL.CONJ, confidence: 'heuristic' });
            if (coordTarget.ccIndex !== undefined) {
                edges.push({ depTokenId: tokens[coordTarget.ccIndex].id, headTokenId: head.id, relation: UD_DEPREL.CC, confidence: 'rule' });
                consumed.add(coordTarget.ccIndex);
            }
            processedPhraseHeads.add(p.headIndex);
            continue;
        }

        if (ppHeadIndices.has(p.headIndex)) {
            const precedingNominal = nearestPrecedingNominal(phrases, p.headIndex - (p.modifierIndices.length + 1), target);
            if (precedingNominal && precedingNominal.headIndex > target) {
                edges.push({ depTokenId: head.id, headTokenId: tokens[precedingNominal.headIndex].id, relation: UD_DEPREL.NMOD, confidence: 'heuristic' });
            } else {
                edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: UD_DEPREL.OBL, confidence: 'heuristic' });
            }
            processedPhraseHeads.add(p.headIndex);
            continue;
        }

        if (!c) {
            edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: UD_DEPREL.DEP, confidence: 'unresolved' });
            processedPhraseHeads.add(p.headIndex);
            continue;
        }

        if (c === GrammaticalCase.NOM && !subjectAssignedFor.has(target) && targetIsVerbal) {
            const hf = head.feats;
            const rf = targetToken.feats;
            const agreementChecked = !!((hf.person && rf.person) || (hf.number && rf.number));
            const agreementOk =
                (!hf.person || !rf.person || hf.person === rf.person) &&
                (!hf.number || !rf.number || hf.number === rf.number);
            if (agreementOk) {
                edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: UD_DEPREL.NSUBJ, confidence: agreementChecked ? 'rule' : 'heuristic' });
                subjectAssignedFor.add(target);
                processedPhraseHeads.add(p.headIndex);
                continue;
            }
        }

        if (c === GrammaticalCase.ACC && targetIsVerbal) {
            const gov = getVerbGovernment(targetToken.lemma).find(g => normalizeCase(g.requiredCase) === GrammaticalCase.ACC);
            edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: gov ? relationForRole(gov.role) : UD_DEPREL.OBJ, confidence: gov ? 'rule' : 'heuristic' });
            processedPhraseHeads.add(p.headIndex);
            continue;
        }

        if (c === GrammaticalCase.DAT && targetIsVerbal) {
            const gov = getVerbGovernment(targetToken.lemma).find(g => normalizeCase(g.requiredCase) === GrammaticalCase.DAT);
            edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: gov ? relationForRole(gov.role) : UD_DEPREL.IOBJ, confidence: gov ? 'rule' : 'heuristic' });
            processedPhraseHeads.add(p.headIndex);
            continue;
        }

        // GEN/INS/LOC/VOC без предлога: смежное с другим существительным —
        // посессивный/атрибутивный nmod, иначе — obl при глагольной цели
        // (напр. чистый творительный "pišu perom") либо неразрешённое.
        const precedingNominal = nearestPrecedingNominal(phrases, p.headIndex - (p.modifierIndices.length + 1), target);
        if (precedingNominal && precedingNominal.headIndex > target) {
            edges.push({ depTokenId: head.id, headTokenId: tokens[precedingNominal.headIndex].id, relation: UD_DEPREL.NMOD, confidence: 'heuristic' });
        } else if (targetIsVerbal) {
            const gov = getVerbGovernment(targetToken.lemma).find(g => normalizeCase(g.requiredCase) === c);
            edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: gov ? relationForRole(gov.role) : UD_DEPREL.OBL, confidence: gov ? 'rule' : 'heuristic' });
        } else {
            edges.push({ depTokenId: head.id, headTokenId: targetToken.id, relation: UD_DEPREL.DEP, confidence: 'unresolved' });
        }
        processedPhraseHeads.add(p.headIndex);
    }

    // Токены вне всех ИГ и не являющиеся сказуемым/AUX: наречия, пунктуация,
    // возвратная частица, междометия — присоединяются к ближайшему
    // предшествующему сказуемому (при сочинении) либо к root; остальное
    // падает в 'dep'/unresolved
    tokens.forEach((t, i) => {
        if (consumed.has(i) || i === rootIdx || predicateIndices.includes(i)) return;
        if (phrases.some(p => p.headIndex === i)) return; // именные вершины уже обработаны выше

        const targetToken = tokens[localTarget(i)];

        if (t.pos === PosType.PUNCT) {
            edges.push({ depTokenId: t.id, headTokenId: targetToken.id, relation: UD_DEPREL.PUNCT, confidence: 'rule' });
        } else if (t.pos === PosType.ADV) {
            edges.push({ depTokenId: t.id, headTokenId: targetToken.id, relation: UD_DEPREL.ADVMOD, confidence: 'heuristic' });
        } else if (REFLEXIVE_SURFACE_FORMS.has(t.surfaceForm.toLowerCase())) {
            edges.push({ depTokenId: t.id, headTokenId: targetToken.id, relation: UD_DEPREL.EXPL, confidence: 'rule' });
        } else if (t.pos === PosType.PART) {
            edges.push({ depTokenId: t.id, headTokenId: targetToken.id, relation: UD_DEPREL.ADVMOD, confidence: 'heuristic' });
        } else if (t.pos === PosType.INTJ) {
            edges.push({ depTokenId: t.id, headTokenId: targetToken.id, relation: UD_DEPREL.DISCOURSE, confidence: 'heuristic' });
        } else if (t.pos === PosType.CCONJ) {
            // сочинительный союз, не разобранный как cc внутри цепочки
            // сказуемых/аргументов (напр. союз без узнанного второго
            // конъюнкта) — неразрешённая, но не потерянная связь
            edges.push({ depTokenId: t.id, headTokenId: targetToken.id, relation: UD_DEPREL.DEP, confidence: 'unresolved' });
        } else {
            edges.push({ depTokenId: t.id, headTokenId: targetToken.id, relation: UD_DEPREL.DEP, confidence: 'unresolved' });
        }
    });

    return edges;
}
