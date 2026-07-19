import {
    AccentParadigm
} from "@/lib/grammar/common/paradigm";
import {
    ProtoStemClass,
    StemExtension,
} from "@/lib/grammar/common/stem";
import {
    PosType
} from "@/lib/grammar/common/pos";
import {
    GrammaticalGender
} from "@/lib/grammar/common/gender";
import { getEnding } from '@/lib/grammar/endingLoader';

// =========================================================================
// 1. СТРОГИЕ СИСТЕМНЫЕ ТИПЫ И КАТЕГОРИИ
// =========================================================================

export enum Case {
    NOMINATIVE = 'nominative',
    ACCUSATIVE = 'accusative',
    GENITIVE = 'genitive',
    DATIVE = 'dative',
    INSTRUMENTAL = 'instrumental',
    LOCATIVE = 'locative',
    VOCATIVE = 'vocative'
}

export enum NumberType {
    SINGULAR = 'singular',
    PLURAL = 'plural',
    DUAL = 'dual'
}

export type FourSlavicTones = 'long_acute' | 'short_acute' | 'long_circumflex' | 'short_circumflex';

export type StemType =

    | 'o_hard' | 'o_soft' | 'a_hard' | 'a_soft'
    | 'u_basis'     // u-основы (synъ)
    | 'i_basis'     // i-основы (kostь, gostь)
    | 'consonant_n' // консонантные n-основы (imę)
    | 'consonant_s'; // консонантные s-основы (nebo)

/**
 * EnhancedDbItem теперь строго отражает схему таблицы Word из Main DB
 */
export interface EnhancedDbItem {
    interslavic: string;
    protoSlavic: string;
    pos: PosType;                       // Строгий PoS Enum
    paradigm: AccentParadigm;           // Строгий Enum Зализняка (A, B, C)
    gender: GrammaticalGender;         // Строгий Родовой Enum (MASC, FEM, NEUT)
    protoStemClass: ProtoStemClass;     // Строгий Класс Праславянской основы
    stemExtension?: StemExtension;      // Строгое Наращение основы (EN, ES, ENT, ER, NONE)
}

export interface FinalUserRequest {
    dbItem: EnhancedDbItem;
    targetCase: Case;
    targetNumber: NumberType;
    preposition?: string;
    flavor?: string;
}

export interface EncliticFourTonesRequest {
    preposition: string;
    accentedNounForm: string;
    paradigm: AccentParadigm;
    targetCase: Case;
    targetNumber: NumberType;
}

// =========================================================================
// 2. ГЛОБАЛЬНЫЙ РЕЕСТР ПРАСЛАВЯНСКИХ ОКОНЧАНИЙ
// =========================================================================

export const SLAVIC_ENDINGS_REGISTRY: Record<StemType, Record<NumberType, Record<Case, string>>> = {
    o_hard: {
        [NumberType.SINGULAR]: {
            [Case.NOMINATIVE]: 'ъ', [Case.ACCUSATIVE]: 'ъ', [Case.GENITIVE]: 'a', [Case.DATIVE]: 'u', [Case.INSTRUMENTAL]: 'omъ', [Case.LOCATIVE]: 'ě', [Case.VOCATIVE]: 'e'
        },
        [NumberType.PLURAL]: {
            [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'y', [Case.GENITIVE]: 'ъ', [Case.DATIVE]: 'omъ', [Case.INSTRUMENTAL]: 'y', [Case.LOCATIVE]: 'ěxъ', [Case.VOCATIVE]: 'i'
        },
        [NumberType.DUAL]: {
            [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'u', [Case.DATIVE]: 'oma', [Case.INSTRUMENTAL]: 'oma', [Case.LOCATIVE]: 'u', [Case.VOCATIVE]: 'a'
        }
    },
    o_soft: {
        [NumberType.SINGULAR]: { [Case.NOMINATIVE]: 'ь', [Case.ACCUSATIVE]: 'ь', [Case.GENITIVE]: 'a', [Case.DATIVE]: 'u', [Case.INSTRUMENTAL]: 'emъ', [Case.LOCATIVE]: 'i', [Case.VOCATIVE]: 'u' },
        [NumberType.PLURAL]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'ę', [Case.GENITIVE]: 'ь', [Case.DATIVE]: 'emъ', [Case.INSTRUMENTAL]: 'i', [Case.LOCATIVE]: 'ixъ', [Case.VOCATIVE]: 'i' },
        [NumberType.DUAL]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'u', [Case.DATIVE]: 'ema', [Case.INSTRUMENTAL]: 'ema', [Case.LOCATIVE]: 'u', [Case.VOCATIVE]: 'a' }
    },
    a_hard: {
        [NumberType.SINGULAR]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'ǫ', [Case.GENITIVE]: 'y', [Case.DATIVE]: 'ě', [Case.INSTRUMENTAL]: 'ojǫ', [Case.LOCATIVE]: 'ě', [Case.VOCATIVE]: 'o' },
        [NumberType.PLURAL]: { [Case.NOMINATIVE]: 'y', [Case.ACCUSATIVE]: 'y', [Case.GENITIVE]: 'ъ', [Case.DATIVE]: 'amъ', [Case.INSTRUMENTAL]: 'ami', [Case.LOCATIVE]: 'axъ', [Case.VOCATIVE]: 'y' },
        [NumberType.DUAL]: { [Case.NOMINATIVE]: 'ě', [Case.ACCUSATIVE]: 'ě', [Case.GENITIVE]: 'u', [Case.DATIVE]: 'ama', [Case.INSTRUMENTAL]: 'ama', [Case.LOCATIVE]: 'u', [Case.VOCATIVE]: 'ě' }
    },
    a_soft: {
        [NumberType.SINGULAR]: { [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'ǫ', [Case.GENITIVE]: 'ę', [Case.DATIVE]: 'i', [Case.INSTRUMENTAL]: 'ejǫ', [Case.LOCATIVE]: 'i', [Case.VOCATIVE]: 'e' },
        [NumberType.PLURAL]: { [Case.NOMINATIVE]: 'ę', [Case.ACCUSATIVE]: 'ę', [Case.GENITIVE]: 'ь', [Case.DATIVE]: 'amъ', [Case.INSTRUMENTAL]: 'ami', [Case.LOCATIVE]: 'axъ', [Case.VOCATIVE]: 'ę' },
        [NumberType.DUAL]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'u', [Case.DATIVE]: 'ama', [Case.INSTRUMENTAL]: 'ama', [Case.LOCATIVE]: 'u', [Case.VOCATIVE]: 'i' }
    },
    u_basis: {
        [NumberType.SINGULAR]: { [Case.NOMINATIVE]: 'ъ', [Case.ACCUSATIVE]: 'ъ', [Case.GENITIVE]: 'u', [Case.DATIVE]: 'ovi', [Case.INSTRUMENTAL]: 'ъmъ', [Case.LOCATIVE]: 'u', [Case.VOCATIVE]: 'u' },
        [NumberType.PLURAL]: { [Case.NOMINATIVE]: 'ove', [Case.ACCUSATIVE]: 'y', [Case.GENITIVE]: 'ovъ', [Case.DATIVE]: 'ъmъ', [Case.INSTRUMENTAL]: 'ъmi', [Case.LOCATIVE]: 'ъxъ', [Case.VOCATIVE]: 'ove' },
        [NumberType.DUAL]: { [Case.NOMINATIVE]: 'y', [Case.ACCUSATIVE]: 'y', [Case.GENITIVE]: 'ovu', [Case.DATIVE]: 'ъma', [Case.INSTRUMENTAL]: 'ъma', [Case.LOCATIVE]: 'ovu', [Case.VOCATIVE]: 'y' }
    },
    i_basis: {
        [NumberType.SINGULAR]: { [Case.NOMINATIVE]: 'ь', [Case.ACCUSATIVE]: 'ь', [Case.GENITIVE]: 'i', [Case.DATIVE]: 'i', [Case.INSTRUMENTAL]: 'ьjǫ', [Case.LOCATIVE]: 'i', [Case.VOCATIVE]: 'i' },
        [NumberType.PLURAL]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ьjъ', [Case.DATIVE]: 'ьmъ', [Case.INSTRUMENTAL]: 'ьmi', [Case.LOCATIVE]: 'ьxъ', [Case.VOCATIVE]: 'i' },
        [NumberType.DUAL]: { [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ьju', [Case.DATIVE]: 'ьma', [Case.INSTRUMENTAL]: 'ьma', [Case.LOCATIVE]: 'ьju', [Case.VOCATIVE]: 'i' }
    },
    consonant_n: {
        [NumberType.SINGULAR]: { [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ene', [Case.DATIVE]: 'eni', [Case.INSTRUMENTAL]: 'enьmъ', [Case.LOCATIVE]: 'eni', [Case.VOCATIVE]: 'e' },
        [NumberType.PLURAL]: { [Case.NOMINATIVE]: 'ena', [Case.ACCUSATIVE]: 'ena', [Case.GENITIVE]: 'enъ', [Case.DATIVE]: 'enъmъ', [Case.INSTRUMENTAL]: 'enъmi', [Case.LOCATIVE]: 'enъxъ', [Case.VOCATIVE]: 'ena' },
        [NumberType.DUAL]: { [Case.NOMINATIVE]: 'eně', [Case.ACCUSATIVE]: 'eně', [Case.GENITIVE]: 'enu', [Case.DATIVE]: 'enьma', [Case.INSTRUMENTAL]: 'enьma', [Case.LOCATIVE]: 'enu', [Case.VOCATIVE]: 'eně' }
    },
    consonant_s: {
        [NumberType.SINGULAR]: { [Case.NOMINATIVE]: 'o', [Case.ACCUSATIVE]: 'o', [Case.GENITIVE]: 'ese', [Case.DATIVE]: 'esi', [Case.INSTRUMENTAL]: 'esьmъ', [Case.LOCATIVE]: 'esi', [Case.VOCATIVE]: 'o' },
        [NumberType.PLURAL]: { [Case.NOMINATIVE]: 'esa', [Case.ACCUSATIVE]: 'esa', [Case.GENITIVE]: 'esъ', [Case.DATIVE]: 'esъmъ', [Case.INSTRUMENTAL]: 'esъmi', [Case.LOCATIVE]: 'esъxъ', [Case.VOCATIVE]: 'esa' },
        [NumberType.DUAL]: { [Case.NOMINATIVE]: 'esě', [Case.ACCUSATIVE]: 'esě', [Case.GENITIVE]: 'esu', [Case.DATIVE]: 'esьma', [Case.INSTRUMENTAL]: 'esьma', [Case.LOCATIVE]: 'esu', [Case.VOCATIVE]: 'esě' }
    }
};

// =========================================================================
// 3. НИЗКОУРОВНЕВЫЕ УТИЛИТЫ ДИАКРИТИКИ И ЮНИКОДА
// =========================================================================

function isShortVowel(char: string): boolean {
    return /[oe]/i.test(char);
}

export function stripAccents(word: string): string {
    return word.replace(/[\u0301\u0300\u0302\u0311]/g, '');
}

function applyFourTonesMark(word: string, syllableIndex: number, tone: FourSlavicTones): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));

    if (matches.length === 0) return word;

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    const char = word[targetIndex];
    let unicodeMark = '\u0301';

    switch (tone) {
        case 'long_acute': unicodeMark = '\u0301'; break;
        case 'short_acute': unicodeMark = '\u0300'; break;
        case 'long_circumflex': unicodeMark = '\u0302'; break;
        case 'short_circumflex': unicodeMark = '\u0311'; break;
    }

    return word.substring(0, targetIndex) + char + unicodeMark + word.substring(targetIndex + 1);
}

function getAcuteToneType(word: string, syllableIndex: number): 'long_acute' | 'short_acute' {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_acute';

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    return isShortVowel(word[targetIndex]) ? 'short_acute' : 'long_acute';
}

function getCircumflexToneType(word: string, syllableIndex: number): 'long_circumflex' | 'short_circumflex' {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_circumflex';

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    return isShortVowel(word[targetIndex]) ? 'short_circumflex' : 'long_circumflex';
}

function accentPrepositionWithFourTones(prep: string, syllableIndex: number): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(prep.matchAll(vowels));

    if (matches.length === 0) return prep;

    const targetMatchIndex = matches[syllableIndex] || matches[0];
    const targetIndex = targetMatchIndex.index!;

    return prep.substring(0, targetIndex) + prep[targetIndex] + '\u0300' + prep.substring(targetIndex + 1);
}

// =========================================================================
// 4. ОПРЕДЕЛИТЕЛИ СТРАТЕГИЙ С КЛАССАМИ ИЗ ENUM
// =========================================================================

export function identifyStemTypeByDb(item: EnhancedDbItem): StemType {
    const { protoStemClass, stemExtension, gender } = item;

    // 1. Консонантные основы (n-основы и s-основы по наращению)
    if (protoStemClass === ProtoStemClass.CONSONANT) {
        if (stemExtension === StemExtension.EN) return 'consonant_n';
        if (stemExtension === StemExtension.ES) return 'consonant_s';
    }

    // 2. u-основы мужского рода (synъ, domъ)
    if (protoStemClass === ProtoStemClass.U_SHORT && gender === GrammaticalGender.MASC) {
        return 'u_basis';
    }

    // 3. i-основы женского и мужского рода (kostь, gostь)
    if (protoStemClass === ProtoStemClass.I_SHORT) {
        return 'i_basis';
    }

    // 4. ā-основы женского и мужского рода (voda, sluga)
    if (protoStemClass === ProtoStemClass.A_LONG) return 'a_hard';
    if (protoStemClass === ProtoStemClass.JA_LONG) return 'a_soft';

    // 5. o-основы (Разведение по родам для среднего и мужского рода)
    if (protoStemClass === ProtoStemClass.O_SHORT) {
        return gender === GrammaticalGender.NEUT ? 'a_hard' : 'o_hard';
    }
    if (protoStemClass === ProtoStemClass.JO_SHORT) {
        return gender === GrammaticalGender.NEUT ? 'a_soft' : 'o_soft';
    }

    return 'o_hard'; // Дефолтный безопасный фоллбек для системы
}

// =========================================================================
// 5. ДВИЖОК ЧЕТЫРЕХТОНОВОГО СЛОВОИЗМЕНЕНИЯ И РЕТРАКЦИИ
// =========================================================================

export function generateBaseNounFormWithFourTones(
    interslavicWord: string,
    paradigm: AccentParadigm,
    stemType: StemType,
    targetCase: Case,
    targetNumber: NumberType,
    flavor: string = 'CORE'
): string {
    const ending = getEnding(stemType, targetNumber, targetCase, flavor);
    const fullForm = interslavicWord + ending;

    // ПАРАДИГМА A: Стабильно-восходящее ударение на корне (Долгий/Краткий Акут)
    if (paradigm === AccentParadigm.A) {
        const toneType = getAcuteToneType(fullForm, 1);
        return applyFourTonesMark(fullForm, 1, toneType);
    }

    // ПАРАДИГМА B: Окситоническая. При падении еров — ретракция на корень (Неокут)
    if (paradigm === AccentParadigm.B) {
        if (ending === 'ъ' || ending === 'ь' || ending === '') {
            const toneType = getAcuteToneType(fullForm, 1);
            return applyFourTonesMark(fullForm, 1, toneType); // bóbъ vs kòńь
        }
        const toneType = getAcuteToneType(fullForm, 0);
        return applyFourTonesMark(fullForm, 0, toneType);   // bobá, bobóvъ
    }

    // ПАРАДИГМА C: Подвижная (Циркумфлексы на корне vs Акуты на окончаниях)
    if (paradigm === AccentParadigm.C) {
        const isMasculine = stemType === 'o_hard' || stemType === 'o_soft' || stemType === 'u_basis';
        const isNeuter = stemType === 'a_hard' || stemType === 'a_soft' || stemType === 'consonant_n' || stemType === 'consonant_s';
        const isFeminine = stemType === 'i_basis' || stemType.startsWith('a_');

        // --- А. ЖЕНСКИЙ РОД (rų̂ka [долгий] vs gorȃ [краткий]) ---
        if (isFeminine) {
            if (targetNumber === NumberType.SINGULAR && (targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE)) {
                return applyFourTonesMark(fullForm, 1, getCircumflexToneType(fullForm, 1));
            }
            return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0));
        }

        // --- Б. МУЖСКОЙ РОД (bȏbъ [краткий циркумфлекс]) ---
        if (isMasculine) {
            if (targetNumber === NumberType.SINGULAR) {
                if (targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE) {
                    return applyFourTonesMark(fullForm, 1, getCircumflexToneType(fullForm, 1));
                }
                return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0)); // Косвенные падежи
            }
            if (targetNumber === NumberType.PLURAL) {
                if (targetCase === Case.ACCUSATIVE) {
                    return applyFourTonesMark(fullForm, 1, getCircumflexToneType(fullForm, 1)); // bóby
                }
                return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0));
            }
            return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0)); // Дуалис
        }

        // --- В. СРЕДНИЙ РОД (tě̂lo [долгий] vs ȏko [краткий]) ---
        if (isNeuter) {
            if (targetNumber === NumberType.SINGULAR) {
                return applyFourTonesMark(fullForm, 1, getCircumflexToneType(fullForm, 1));
            }
            if (targetNumber === NumberType.PLURAL) {
                return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0)); // telá
            }
            if (targetNumber === NumberType.DUAL) {
                return applyFourTonesMark(fullForm, 1, getCircumflexToneType(fullForm, 1)); // tě̂lě
            }
        }
    }

    return fullForm;
}

export function applyPrepositionEncliticWithFourTones(request: EncliticFourTonesRequest): string {
    const { preposition, accentedNounForm, paradigm, targetCase, targetNumber } = request;
    const cleanPrep = preposition.toLowerCase().trim();

    // Ретракция невозможна на нескладовые предлоги без вокалического ядра (в, с, к)
    const prepVowelsCount = (cleanPrep.match(/[aeiouyěęǫọų]/gi) || []).length;
    if (prepVowelsCount === 0) {
        return `${preposition} ${accentedNounForm}`;
    }

    // Проверяем наличие праславянских нисходящих тонов (циркумфлексов U+0302 или U+0311)
    const hasCircumflex = /[\u0302\u0311]/.test(accentedNounForm);
    let shouldRetract = paradigm === AccentParadigm.C && hasCircumflex;

    // Верификация по сетке энклиноменальных падежей Зализняка
    if (shouldRetract) {
        const isAccusativeSg = targetNumber === NumberType.SINGULAR && targetCase === Case.ACCUSATIVE;
        const isNominativeSg = targetNumber === NumberType.SINGULAR && targetCase === Case.NOMINATIVE;
        const isAccusativePl = targetNumber === NumberType.PLURAL && targetCase === Case.ACCUSATIVE;
        const isLocativeSg = targetNumber === NumberType.SINGULAR && targetCase === Case.LOCATIVE;

        shouldRetract = isAccusativeSg || isNominativeSg || isAccusativePl || isLocativeSg;
    }

    if (shouldRetract) {
        const cleanNoun = stripAccents(accentedNounForm);
        const stressedPrep = accentPrepositionWithFourTones(cleanPrep, 0); // Проставляем краткий гравис на предлог
        return `${stressedPrep} ${cleanNoun}`;
    }

    return `${preposition} ${accentedNounForm}`;
}

// =========================================================================
// 6. ЦЕНТРАЛЬНАЯ ГЛАВНАЯ ТОЧКА ВХОДА (Экспорт модуля)
// =========================================================================

export function declineWordAutomatically(request: FinalUserRequest): string {
    const { dbItem, targetCase, targetNumber, preposition, flavor } = request;

    // Шаг 1: Идентификация флексийного класса
    const stemType = identifyStemTypeByDb(dbItem);

    // Шаг 2: Генерация базовой словоформы с расчетом 4 тонов
    const baseAccentedNoun = generateBaseNounFormWithFourTones(
        dbItem.interslavic,
        dbItem.paradigm,
        stemType,
        targetCase,
        targetNumber,
        flavor
    );

    // Шаг 3: Если предлог опущен — отдаем форму как есть
    if (!preposition) {
        return baseAccentedNoun;
    }

    // Шаг 4: Прогоняем фразу через автоматический тоновый движок клитик
    return applyPrepositionEncliticWithFourTones({
        preposition,
        accentedNounForm: baseAccentedNoun,
        paradigm: dbItem.paradigm,
        targetCase,
        targetNumber
    });
}
