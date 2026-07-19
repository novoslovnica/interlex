import { AccentParadigm, ProtoStemClass, GrammaticalGender } from '@/lib/grammar/common';
import { Case, NumberType, FourSlavicTones, stripAccents } from '../noun';

export type AdjStemType = 'adj_hard' | 'adj_soft';
export type AdjectiveTypeClass = 'relative' | 'qualitative';

export interface EnhancedAdjDbItem {
    interslavic: string;       // "novy", "veliky", "kamienny"
    protoSlavic: string;
    paradigm: AccentParadigm; // A, B, C
    protoStemClass: ProtoStemClass;
    adjClass: AdjectiveTypeClass; // Мета-класс: качественное или относительное
}

export interface AdjFormRequest {
    dbItem: EnhancedAdjDbItem;
    targetCase: Case;
    targetNumber: NumberType;
    targetGender: GrammaticalGender;
    degree?: 'pos' | 'comp' | 'sup'; // Добавляем строгий контроль степени
}

export const ADJECTIVE_ENDINGS_REGISTRY: Record<AdjStemType, Record<NumberType, Record<GrammaticalGender, Record<Case, string>>>> = {
    adj_hard: {
        [NumberType.SINGULAR]: {
            [GrammaticalGender.MASC]: { [Case.NOMINATIVE]: 'y', [Case.ACCUSATIVE]: 'y', [Case.GENITIVE]: 'ogo', [Case.DATIVE]: 'omu', [Case.INSTRUMENTAL]: 'ym', [Case.LOCATIVE]: 'om', [Case.VOCATIVE]: 'y' },
            [GrammaticalGender.FEM]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'ǫ', [Case.GENITIVE]: 'oj', [Case.DATIVE]: 'oj', [Case.INSTRUMENTAL]: 'ojų', [Case.LOCATIVE]: 'oj', [Case.VOCATIVE]: 'a' },
            [GrammaticalGender.NEUT]: { [Case.NOMINATIVE]: 'o', [Case.ACCUSATIVE]: 'o', [Case.GENITIVE]: 'ogo', [Case.DATIVE]: 'omu', [Case.INSTRUMENTAL]: 'ym', [Case.LOCATIVE]: 'om', [Case.VOCATIVE]: 'o' }
        },
        [NumberType.PLURAL]: {
            [GrammaticalGender.MASC]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'yh', [Case.DATIVE]: 'ym', [Case.INSTRUMENTAL]: 'ymi', [Case.LOCATIVE]: 'yh', [Case.VOCATIVE]: 'i' },
            [GrammaticalGender.FEM]: { [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'yh', [Case.DATIVE]: 'ym', [Case.INSTRUMENTAL]: 'ymi', [Case.LOCATIVE]: 'yh', [Case.VOCATIVE]: 'e' },
            [GrammaticalGender.NEUT]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'yh', [Case.DATIVE]: 'ym', [Case.INSTRUMENTAL]: 'ymi', [Case.LOCATIVE]: 'yh', [Case.VOCATIVE]: 'a' }
        },
        [NumberType.DUAL]: {
            [GrammaticalGender.MASC]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'oju', [Case.DATIVE]: 'yma', [Case.INSTRUMENTAL]: 'yma', [Case.LOCATIVE]: 'oju', [Case.VOCATIVE]: 'a' },
            [GrammaticalGender.FEM]: { [Case.NOMINATIVE]: 'ě', [Case.ACCUSATIVE]: 'ě', [Case.GENITIVE]: 'oju', [Case.DATIVE]: 'yma', [Case.INSTRUMENTAL]: 'yma', [Case.LOCATIVE]: 'oju', [Case.VOCATIVE]: 'ě' },
            [GrammaticalGender.NEUT]: { [Case.NOMINATIVE]: 'ě', [Case.ACCUSATIVE]: 'ě', [Case.GENITIVE]: 'oju', [Case.DATIVE]: 'yma', [Case.INSTRUMENTAL]: 'yma', [Case.LOCATIVE]: 'oju', [Case.VOCATIVE]: 'ě' }
        }
    },
    adj_soft: {
        [NumberType.SINGULAR]: {
            [GrammaticalGender.MASC]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ego', [Case.DATIVE]: 'emu', [Case.INSTRUMENTAL]: 'im', [Case.LOCATIVE]: 'em', [Case.VOCATIVE]: 'i' },
            [GrammaticalGender.FEM]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'ǫ', [Case.GENITIVE]: 'ej', [Case.DATIVE]: 'ej', [Case.INSTRUMENTAL]: 'ejų', [Case.LOCATIVE]: 'ej', [Case.VOCATIVE]: 'a' },
            [GrammaticalGender.NEUT]: { [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ego', [Case.DATIVE]: 'emu', [Case.INSTRUMENTAL]: 'im', [Case.LOCATIVE]: 'em', [Case.VOCATIVE]: 'e' }
        },
        [NumberType.PLURAL]: {
            [GrammaticalGender.MASC]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ih', [Case.DATIVE]: 'im', [Case.INSTRUMENTAL]: 'imi', [Case.LOCATIVE]: 'ih', [Case.VOCATIVE]: 'i' },
            [GrammaticalGender.FEM]: { [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ih', [Case.DATIVE]: 'im', [Case.INSTRUMENTAL]: 'imi', [Case.LOCATIVE]: 'ih', [Case.VOCATIVE]: 'e' },
            [GrammaticalGender.NEUT]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'ih', [Case.DATIVE]: 'im', [Case.INSTRUMENTAL]: 'imi', [Case.LOCATIVE]: 'ih', [Case.VOCATIVE]: 'a' }
        },
        [NumberType.DUAL]: {
            [GrammaticalGender.MASC]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'eju', [Case.DATIVE]: 'ima', [Case.INSTRUMENTAL]: 'ima', [Case.LOCATIVE]: 'eju', [Case.VOCATIVE]: 'a' },
            [GrammaticalGender.FEM]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'eju', [Case.DATIVE]: 'ima', [Case.INSTRUMENTAL]: 'ima', [Case.LOCATIVE]: 'eju', [Case.VOCATIVE]: 'i' },
            [GrammaticalGender.NEUT]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'eju', [Case.DATIVE]: 'ima', [Case.INSTRUMENTAL]: 'ima', [Case.LOCATIVE]: 'eju', [Case.VOCATIVE]: 'i' }
        }
    }
};

const { applyFourTonesMark, getAcuteToneType, getCircumflexToneType } = require('../numerals/cardinal');

export function identifyAdjStemType(item: EnhancedAdjDbItem): AdjStemType {
    return item.protoStemClass === ProtoStemClass.JO_SHORT ? 'adj_soft' : 'adj_hard';
}

/**
 * Главная функция генерации конкретной словоформы прилагательного
 */
export function generateAdjectiveForm(request: AdjFormRequest): string {
    const { dbItem, targetCase, targetNumber, targetGender, degree = 'pos' } = request;
    const lemma = dbItem.interslavic.toLowerCase().trim();

    let stemType = identifyAdjStemType(dbItem);
    let cleanBase = lemma.slice(0, -1); // Отрезаем окончание у леммы (nov-, pěš-)
    let currentParadigm = dbItem.paradigm;

    // -----------------------------------------------------------------------
    // ДЕРИВАЦИОННЫЙ СЛОЙ СТЕПЕНЕЙ СРАВНЕНИЯ
    // -----------------------------------------------------------------------
    if (degree === 'comp' || degree === 'sup') {
        // Праславянский суффикс компаратива -ějьš-. На конце леммы всегда мягкая флексия "i"
        // Сравнительная и превосходная степени СТРОГО переходят на мягкий тип склонения
        stemType = 'adj_soft';
        cleanBase = cleanBase + 'ějš';

        // Исторически суффикс -ějьš- всегда перетягивал на себя ударение (Новый Акут)
        // Поэтому компаратив и суперлатив автоматически переходят в парадигму A (фиксированное на суффиксе)
        currentParadigm = AccentParadigm.A;
    }

    const ending = ADJECTIVE_ENDINGS_REGISTRY[stemType][targetNumber][targetGender][targetCase];
    let fullForm = cleanBase + ending;

    // Превосходная степень добавляет префикс най-
    if (degree === 'sup') {
        fullForm = 'naj' + fullForm;
    }

    // =========================================================================
    // АКЦЕНТОЛОГИЧЕСКИЙ РАСЧЕТ ДЛЯ ПРИЛАГАТЕЛЬНЫХ
    // =========================================================================

    // ПАРАДИГМА A (или принудительный суффиксальный акут для степеней сравнения)
    if (currentParadigm === AccentParadigm.A) {
        if (degree === 'comp' || degree === 'sup') {
            // Ищем гласную суффикса "ě" в строке. Она всегда предпоследняя в слове перед флексией
            const totalVowels = (fullForm.match(/[aeiouyěęǫọų]/gi) || []).length;
            // Ставим жесткий долгий акут на суффикс (nově́jšy, najnově́jšego)
            return applyFourTonesMark(fullForm, totalVowels - (degree === 'sup' ? 2 : 2), 'long_acute');
        }
        return applyFourTonesMark(fullForm, 1, getAcuteToneType(fullForm, 1));
    }

    // ПАРАДИГМА B (Окситонная): На первый слог окончания
    if (currentParadigm === AccentParadigm.B) {
        if (fullForm.endsWith('ъ') || fullForm.endsWith('ь') || fullForm.endsWith('')) {
            return applyFourTonesMark(fullForm, 1, getAcuteToneType(fullForm, 1));
        }
        const totalVowels = (fullForm.match(/[aeiouyěęǫọų]/gi) || []).length;
        const baseVowels = (cleanBase.match(/[aeiouyěęǫọų]/gi) || []).length;
        const syllableFromEnd = totalVowels - baseVowels - 1;
        return applyFourTonesMark(fullForm, Math.max(0, syllableFromEnd), getAcuteToneType(fullForm, Math.max(0, syllableFromEnd)));
    }

    // ПАРАДИГМА C (Мобильная): Отражение циркумфлекса только в Nom/Acc ед.ч.
    if (currentParadigm === AccentParadigm.C) {
        const isNomOrAccSg = targetNumber === NumberType.SINGULAR && (targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE);
        if (isNomOrAccSg) {
            return applyFourTonesMark(fullForm, 1, getCircumflexToneType(fullForm, 1)); // nòvy
        }
        return applyFourTonesMark(fullForm, 1, getAcuteToneType(fullForm, 1)); // Косвенные падежи баритонируются
    }

    return fullForm;
}
