import { AccentParadigm, GrammaticalGender } from '@/types/morphology';
import { Case, NumberType, FourSlavicTones } from './nounEngine';

export type CollectiveClass = 'oje_type' | 'ero_type'; // dvoje vs četvero

export interface CollectiveDbItem {
    interslavic: string;       // "dvoje", "četvero"
    protoSlavic: string;
    paradigm: AccentParadigm; // Исторически это окситонеза (B) или мобильный тип (C)
    collClass: CollectiveClass;
}

// Реестр флексий собирательных числительных (склоняются по падежам во множественном числе)
const COLLECTIVE_ENDINGS: Record<CollectiveClass, Record<Case, string>> = {
    oje_type: {
        // dvoje -> dvojih, dvojim...
        [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ih', [Case.DATIVE]: 'im', [Case.INSTRUMENTAL]: 'imi', [Case.LOCATIVE]: 'ih', [Case.VOCATIVE]: 'e'
    },
    ero_type: {
        // četvero -> četveryh, četverym...
        [Case.NOMINATIVE]: 'o', [Case.ACCUSATIVE]: 'o', [Case.GENITIVE]: 'yh', [Case.DATIVE]: 'ym', [Case.INSTRUMENTAL]: 'ymi', [Case.LOCATIVE]: 'yh', [Case.VOCATIVE]: 'o'
    }
};

export function declineCollectiveNumeral(request: {
    dbItem: CollectiveDbItem;
    targetCase: Case;
}): string {
    const { dbItem, targetCase } = request;
    const lemma = dbItem.interslavic.toLowerCase().trim();
    const { collClass, paradigm } = dbItem;

    // Отрезаем родовое окончание праславянского номинатива (-je / -o), чтобы получить суффиксальную основу (dvoj-, četver-)
    const cleanBase = collClass === 'oje_type' ? lemma.slice(0, -2) + 'j' : lemma.slice(0, -1);
    const ending = COLLECTIVE_ENDINGS[collClass][targetCase];
    const fullForm = cleanBase + ending;

    // Хелперы Юникода (импортируем из базового тонового процессора)
    const { applyFourTonesMark, getAcuteToneType, getCircumflexToneType } = require('./numeralCardinal');

    // ПАРАДИГМА A: Неподвижное ударение
    if (paradigm === AccentParadigm.A) {
        return applyFourTonesMark(fullForm, 1, getAcuteToneType(fullForm, 1));
    }

    // ПАРАДИГМА B / C: Собирательные числительные удерживают ударение СТРОГО на суффиксе (dvójih, četvéryh)
    // Это обусловлено праславянской ретракцией на долгий суффиксальный слог.
    const totalVowels = (fullForm.match(/[aeiouyěęǫọų]/gi) || []).length;
    const baseVowels = (cleanBase.match(/[aeiouyěęǫọų]/gi) || []).length;

    // Вычисляем позицию суффикса (последний слог основы)
    const suffixSyllableIndex = totalVowels - baseVowels;

    return applyFourTonesMark(fullForm, suffixSyllableIndex, getAcuteToneType(fullForm, suffixSyllableIndex));
}
