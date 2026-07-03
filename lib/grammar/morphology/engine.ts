import { PosType, isValidPos } from '@/lib/grammar/common';
import { EngineWordInput, GeneratedForm } from '@/lib/grammar/morphology';
import * as p from './processors';

/**
 * Генерирует все словоформы для лексемы. На замене классов — чистая функция.
 */
export function generateWordForms(word: EngineWordInput): GeneratedForm[] {
    if (!word.isv || !word.pos) {
        return [{ surfaceForm: word.isv || '', feats: {} }];
    }

    const posTag = word.pos.toUpperCase();

    if (!isValidPos(posTag)) {
        console.warn(`[MorphologyEngine] Unknown PoS tag: ${word.pos} for word ID ${word.id}`);
        return [{ surfaceForm: word.isv, feats: {} }];
    }

    switch (posTag as PosType) {
        case PosType.NOUN:
            return p.processNoun(word);

        case PosType.VERB:
            return p.processVerb(word);

        case PosType.ADJ:
            return p.processAdjective(word);

        case PosType.PRON:
            return p.processPronoun(word);

        case PosType.DET:
            return p.processDeterminer(word);

        case PosType.NUM:
            return p.processNumeral(word);

        case PosType.ADV:
            return p.processAdverb(word);

        case PosType.AUX:
            return p.processAuxiliary(word);

        // Неизменяемые категории
        case PosType.ADP:
        case PosType.CCONJ:
        case PosType.SCONJ:
        case PosType.PART:
        case PosType.INTJ:
        case PosType.PUNCT:
        case PosType.SYM:
        case PosType.X:
            return p.processUninflected(word);

        default:
            return [{ surfaceForm: word.isv, feats: {} }];
    }
}
