import { PosType, isValidPos } from '@/lib/grammar/common';
import { EngineWordInput, GeneratedForm } from '@/lib/grammar/morphology';
import { normalizeSoftConsonants, collapseDoubleJ } from '@/lib/isv';
import * as p from './processors';

const ACCENT_CHARS = /[\u0300\u0301\u0302\u0311]/g;

export function stripCombiningAccents(form: string): string {
    return form.replace(ACCENT_CHARS, '');
}

export function generateWordForms(word: EngineWordInput, stripAccents?: boolean): GeneratedForm[] {
    if (!word.isv || !word.pos) {
        return [{ surfaceForm: stripAccents ? stripCombiningAccents(word.isv || '') : (word.isv || ''), feats: {} }];
    }

    const posTag = word.pos.toUpperCase();

    if (!isValidPos(posTag)) {
        console.warn(`[MorphologyEngine] Unknown PoS tag: ${word.pos} for word ID ${word.id}`);
        return [{ surfaceForm: stripAccents ? stripCombiningAccents(word.isv) : word.isv, feats: {} }];
    }

    const dispatch = (): GeneratedForm[] => {
        switch (posTag as PosType) {
            case PosType.NOUN: return p.processNoun(word);
            case PosType.VERB: return p.processVerb(word);
            case PosType.ADJ: return p.processAdjective(word);
            case PosType.PRON: return p.processPronoun(word);
            case PosType.DET: return p.processDeterminer(word);
            case PosType.NUM: return p.processNumeral(word);
            case PosType.ADV: return p.processAdverb(word);
            case PosType.AUX: return p.processAuxiliary(word);
            case PosType.ADP:
            case PosType.CCONJ:
            case PosType.SCONJ:
            case PosType.PART:
            case PosType.INTJ:
            case PosType.PUNCT:
            case PosType.SYM:
            case PosType.X: return p.processUninflected(word);
            default: return [{ surfaceForm: word.isv || '', feats: {} }];
        }
    };

    const forms = dispatch();

    // Нормализация мягких согласных перед i, e, ę, ě и схлопывание jj
    const normalized = forms.map(f => ({
        ...f,
        surfaceForm: collapseDoubleJ(normalizeSoftConsonants(f.surfaceForm)),
    }));

    if (!stripAccents) return normalized;

    return normalized.map(f => ({
        ...f,
        surfaceForm: stripCombiningAccents(f.surfaceForm),
    }));
}
