import { PosType } from '@/lib/grammar/common';
import { SyntaxToken, DependencyEdge } from './types';
import { UD_DEPREL } from './deprel';
import { normalizeCase } from './caseUtils';

const NOMINAL_HEAD_POS = new Set<string>([PosType.NOUN, PosType.PROPN, PosType.PRON]);
const AGREEING_MODIFIER_POS = new Set<string>([PosType.DET, PosType.ADJ]);

export interface NounPhrase {
    headIndex: number;
    modifierIndices: number[];
}

function agrees(mod: SyntaxToken, head: SyntaxToken): boolean {
    const mf = mod.feats;
    const hf = head.feats;
    const modCase = normalizeCase(mf.case);
    const headCase = normalizeCase(hf.case);
    if (modCase && headCase && modCase !== headCase) return false;
    if (mf.number && hf.number && mf.number !== hf.number) return false;
    if (mf.gender && hf.gender && mf.gender !== hf.gender) return false;
    return true;
}

function hasComparableCase(mod: SyntaxToken, head: SyntaxToken): boolean {
    return !!(normalizeCase(mod.feats.case) && normalizeCase(head.feats.case));
}

function isModifierPos(pos: string): boolean {
    return AGREEING_MODIFIER_POS.has(pos) || pos === PosType.NUM;
}

/**
 * Группирует DET/ADJ/NUM вокруг ближайшей следующей именной вершины
 * (NOUN/PROPN/PRON) в один проход слева направо — без обратного поиска,
 * чтобы не путать модификаторы между двумя соседними именными группами.
 * Постпозитивные определения (после вершины) в Фазе 2 не распознаются —
 * известное ограничение, см. AGENTS.md-паттерн явного документирования
 * недоделанного вместо тихого замалчивания.
 *
 * NUM — особый случай: числительные 5+ в славянских языках нередко требуют
 * от существительного другого падежа (генитив), а не согласования — в этом
 * проекте эта грамматика ещё не верифицирована (см. AGENTS.md про
 * numeral_5-10). Поэтому NUM присоединяется по одной лишь смежности, без
 * проверки падежа, и всегда с confidence 'heuristic', а не 'rule'.
 *
 * Фаза 3: сочинённые модификаторы одного типа внутри серии — как через союз
 * ("silny i vlažny vozduh"), так и бессоюзно через запятую, в том числе
 * смешанно ("Ekonomičny, historičsky i kulturny centr" — Oxford-style
 * список). Запятая между однотипными модификаторами прозрачна для сборки
 * серии; сама по себе (без последующего однотипного модификатора) серию не
 * запускает и не продолжает — это не "запятая = соединитель", а "запятая
 * не должна разрывать уже опознанный список". Первый модификатор острова
 * получает обычную связь к вершине ИГ (det/amod/nummod), все последующие —
 * conj к ПЕРВОМУ (канонический UD-паттерн для списков из 3+ элементов, а
 * не цепочкой друг к другу), союз (если был) — cc к тому конъюнкту, перед
 * которым стоит.
 */
export function chunkNounPhrases(tokens: SyntaxToken[]): { phrases: NounPhrase[]; edges: DependencyEdge[] } {
    const phrases: NounPhrase[] = [];
    const edges: DependencyEdge[] = [];
    let i = 0;

    while (i < tokens.length) {
        const pos = tokens[i].pos as string;

        if (isModifierPos(pos)) {
            const runStart = i;
            while (i < tokens.length) {
                if (isModifierPos(tokens[i].pos as string)) { i++; continue; }
                if (tokens[i].pos === PosType.CCONJ && i + 1 < tokens.length && isModifierPos(tokens[i + 1].pos as string)) { i++; continue; }
                if (tokens[i].surfaceForm === ',' && i + 1 < tokens.length && isModifierPos(tokens[i + 1].pos as string)) { i++; continue; }
                break;
            }

            if (i < tokens.length && NOMINAL_HEAD_POS.has(tokens[i].pos as string)) {
                const headIndex = i;
                const head = tokens[headIndex];
                const modifierIndices: number[] = [];
                let firstAccepted: number | null = null;
                let pendingCconj: number | null = null;
                let sawSeparator = false;

                for (let j = runStart; j < headIndex; j++) {
                    const mod = tokens[j];

                    if (mod.pos === PosType.CCONJ) {
                        pendingCconj = j;
                        sawSeparator = true;
                        continue;
                    }
                    if (mod.surfaceForm === ',') {
                        sawSeparator = true;
                        continue; // прозрачна для сборки серии; получит punct на уровне клаузы
                    }

                    const isNum = mod.pos === PosType.NUM;
                    if (!isNum && !agrees(mod, head)) { pendingCconj = null; sawSeparator = false; continue; } // явное рассогласование — не считаем модификатором этой ИГ

                    const coordinatesWithFirst =
                        sawSeparator && firstAccepted !== null && tokens[firstAccepted].pos === mod.pos;

                    if (coordinatesWithFirst) {
                        modifierIndices.push(j);
                        edges.push({
                            depTokenId: mod.id,
                            headTokenId: tokens[firstAccepted as number].id,
                            relation: UD_DEPREL.CONJ,
                            confidence: isNum ? 'heuristic' : hasComparableCase(mod, head) ? 'rule' : 'heuristic',
                        });
                        if (pendingCconj !== null) {
                            modifierIndices.push(pendingCconj);
                            edges.push({
                                depTokenId: tokens[pendingCconj].id,
                                headTokenId: mod.id,
                                relation: UD_DEPREL.CC,
                                confidence: 'rule',
                            });
                        }
                    } else {
                        modifierIndices.push(j);
                        edges.push({
                            depTokenId: mod.id,
                            headTokenId: head.id,
                            relation: isNum ? UD_DEPREL.NUMMOD : mod.pos === PosType.DET ? UD_DEPREL.DET : UD_DEPREL.AMOD,
                            confidence: isNum ? 'heuristic' : hasComparableCase(mod, head) ? 'rule' : 'heuristic',
                        });
                        firstAccepted = j;
                    }

                    pendingCconj = null;
                    sawSeparator = false;
                }

                phrases.push({ headIndex, modifierIndices });
                i = headIndex + 1;
            }
            // серия модификаторов без именной вершины после неё — токены
            // остаются без ребра, решает Фаза 4 или ручная правка
        } else if (NOMINAL_HEAD_POS.has(pos)) {
            phrases.push({ headIndex: i, modifierIndices: [] });
            i++;
        } else {
            i++;
        }
    }

    return { phrases, edges };
}
