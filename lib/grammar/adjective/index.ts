import {
    AccentParadigm,
    ProtoStemClass,
    GrammaticalGender
} from '@/types/morphology'; // Системные Enum из таблицы Word
import { Case, NumberType, FourSlavicTones, stripAccents } from './nounEngine';

// =========================================================================
// 1. СТРОГИЕ ИНТЕРФЕЙСЫ И ТИПЫ ДАННЫХ
// =========================================================================

export type AdjStemType = 'adj_hard' | 'adj_soft';

export interface EnhancedAdjDbItem {
    interslavic: string;      // Базовая форма (н-р: "novy", "pěšy")
    protoSlavic: string;
    paradigm: AccentParadigm; // A, B, C
    protoStemClass: ProtoStemClass; // o / jo основы
}

export interface AdjFormRequest {
    dbItem: EnhancedAdjDbItem;
    targetCase: Case;
    targetNumber: NumberType;
    targetGender: GrammaticalGender;
}

// =========================================================================
// 2. ГЛОБАЛЬНЫЙ РЕЕСТР ПОЛНЫХ (МЕСТОИМЕННЫХ) СЛАВЯНСКИХ ОКОНЧАНИЙ
// =========================================================================

export const ADJECTIVE_ENDINGS_REGISTRY: Record<AdjStemType, Record<NumberType, Record<GrammaticalGender, Record<Case, string>>>> = {
    adj_hard: {
        [NumberType.SINGULAR]: {
            [GrammaticalGender.MASC]: {
                [Case.NOMINATIVE]: 'y', [Case.ACCUSATIVE]: 'y', [Case.GENITIVE]: 'ogo', [Case.DATIVE]: 'omu', [Case.INSTRUMENTAL]: 'ym', [Case.LOCATIVE]: 'om', [Case.VOCATIVE]: 'y'
            },
            [GrammaticalGender.FEM]: {
                [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'ǫ', [Case.GENITIVE]: 'oj', [Case.DATIVE]: 'oj', [Case.INSTRUMENTAL]: 'ojų', [Case.LOCATIVE]: 'oj', [Case.VOCATIVE]: 'a'
            },
            [GrammaticalGender.NEUT]: {
                [Case.NOMINATIVE]: 'o', [Case.ACCUSATIVE]: 'o', [Case.GENITIVE]: 'ogo', [Case.DATIVE]: 'omu', [Case.INSTRUMENTAL]: 'ym', [Case.LOCATIVE]: 'om', [Case.VOCATIVE]: 'o'
            }
        },
        [NumberType.PLURAL]: {
            [GrammaticalGender.MASC]: {
                [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'yh', [Case.DATIVE]: 'ym', [Case.INSTRUMENTAL]: 'ymi', [Case.LOCATIVE]: 'yh', [Case.VOCATIVE]: 'i'
            },
            [GrammaticalGender.FEM]: {
                [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'yh', [Case.DATIVE]: 'ym', [Case.INSTRUMENTAL]: 'ymi', [Case.LOCATIVE]: 'yh', [Case.VOCATIVE]: 'e'
            },
            [GrammaticalGender.NEUT]: {
                [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'yh', [Case.DATIVE]: 'ym', [Case.INSTRUMENTAL]: 'ymi', [Case.LOCATIVE]: 'yh', [Case.VOCATIVE]: 'a'
            }
        },
        [NumberType.DUAL]: {
            [GrammaticalGender.MASC]: {
                [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'oju', [Case.DATIVE]: 'yma', [Case.INSTRUMENTAL]: 'yma', [Case.LOCATIVE]: 'oju', [Case.VOCATIVE]: 'a'
            },
            [GrammaticalGender.FEM]: {
                [Case.NOMINATIVE]: 'ě', [Case.ACCUSATIVE]: 'ě', [Case.GENITIVE]: 'oju', [Case.DATIVE]: 'yma', [Case.INSTRUMENTAL]: 'yma', [Case.LOCATIVE]: 'oju', [Case.VOCATIVE]: 'ě'
            },
            [GrammaticalGender.NEUT]: {
                [Case.NOMINATIVE]: 'ě', [Case.ACCUSATIVE]: 'ě', [Case.GENITIVE]: 'oju', [Case.DATIVE]: 'yma', [Case.INSTRUMENTAL]: 'yma', [Case.LOCATIVE]: 'oju', [Case.VOCATIVE]: 'ě'
            }
        }
    },
    adj_soft: {
        [NumberType.SINGULAR]: {
            [GrammaticalGender.MASC]: {
                [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ego', [Case.DATIVE]: 'emu', [Case.INSTRUMENTAL]: 'im', [Case.LOCATIVE]: 'em', [Case.VOCATIVE]: 'i'
            },
            [GrammaticalGender.FEM]: {
                [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'ǫ', [Case.GENITIVE]: 'ej', [Case.DATIVE]: 'ej', [Case.INSTRUMENTAL]: 'ejų', [Case.LOCATIVE]: 'ej', [Case.VOCATIVE]: 'a'
            },
            [GrammaticalGender.NEUT]: {
                [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ego', [Case.DATIVE]: 'emu', [Case.INSTRUMENTAL]: 'im', [Case.LOCATIVE]: 'em', [Case.VOCATIVE]: 'e'
            }
        },
        [NumberType.PLURAL]: {
            [GrammaticalGender.MASC]: {
                [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ih', [Case.DATIVE]: 'im', [Case.INSTRUMENTAL]: 'imi', [Case.LOCATIVE]: 'ih', [Case.VOCATIVE]: 'i'
            },
            [GrammaticalGender.FEM]: {
                [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'e', [Case.GENITIVE]: 'ih', [Case.DATIVE]: 'im', [Case.INSTRUMENTAL]: 'imi', [Case.LOCATIVE]: 'ih', [Case.VOCATIVE]: 'e'
            },
            [GrammaticalGender.NEUT]: {
                [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'ih', [Case.DATIVE]: 'im', [Case.INSTRUMENTAL]: 'imi', [Case.LOCATIVE]: 'ih', [Case.VOCATIVE]: 'a'
            }
        },
        [NumberType.DUAL]: {
            [GrammaticalGender.MASC]: {
                [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'eju', [Case.DATIVE]: 'ima', [Case.INSTRUMENTAL]: 'ima', [Case.LOCATIVE]: 'eju', [Case.VOCATIVE]: 'a'
            },
            [GrammaticalGender.FEM]: {
                [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'eju', [Case.DATIVE]: 'ima', [Case.INSTRUMENTAL]: 'ima', [Case.LOCATIVE]: 'eju', [Case.VOCATIVE]: 'i'
            },
            [GrammaticalGender.NEUT]: {
                [Case.NOMINATIVE]: 'i', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'eju', [Case.DATIVE]: 'ima', [Case.INSTRUMENTAL]: 'ima', [Case.LOCATIVE]: 'eju', [Case.VOCATIVE]: 'i'
            }
        }
    }
};

// =========================================================================
// 3. ТОНОВЫЕ ХЕЛПЕРЫ ДЛЯ ПРИЛАГАТЕЛЬНЫХ
// =========================================================================

function isShortVowel(char: string): boolean {
    return /[oe]/i.test(char);
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
        case 'long_acute': unicodeMark = '\u0301'; break;       // ́
        case 'short_acute': unicodeMark = '\u0300'; break;      // ̀
        case 'long_circumflex': unicodeMark = '\u0302'; break;  // ̂
        case 'short_circumflex': unicodeMark = '\u0311'; break; // ̑
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

// =========================================================================
// 4. ОПРЕДЕЛИТЕЛЬ ОСНОВЫ (ТВЕРДАЯ / МЯГКАЯ)
// =========================================================================

export function identifyAdjStemType(item: EnhancedAdjDbItem): AdjStemType {
    // jo-основы (древние мягкие) -> adj_soft, o-основы (древние твердые) -> adj_hard
    if (item.protoStemClass === ProtoStemClass.JO_SHORT) {
        return 'adj_soft';
    }
    return 'adj_hard';
}

// =========================================================================
// 5. ДВИЖОК СКЛОНЕНИЯ ПРИЛАГАТЕЛЬНЫХ
// =========================================================================

export function generateAdjectiveForm(request: AdjFormRequest): string {
    const { dbItem, targetCase, targetNumber, targetGender } = request;

    const stemType = identifyAdjStemType(dbItem);
    const ending = ADJECTIVE_ENDINGS_REGISTRY[stemType][targetNumber][targetGender][targetCase];

    // Отрезаем изначальное словарное окончание полных форм межславянского (y/i) для получения корня
    const cleanBase = dbItem.interslavic.slice(0, -1);
    const fullForm = cleanBase + ending;

    // ПАРАДИГМА A: Абсолютный неподвижный баритонез (Ударение на корне)
    if (dbItem.paradigm === AccentParadigm.A) {
        const toneType = getAcuteToneType(fullForm, 1); // Слог перед флексией
        return applyFourTonesMark(fullForm, 1, toneType);
    }

    // ПАРАДИГМА B (Окситоническая): Ударение падает на первый слог флексии полного окончания
    if (dbItem.paradigm === AccentParadigm.B) {
        // В полных прилагательных окончание почти всегда состоит из 1 или 2 слогов (н-р: -ogo, -omu)
        // Ставим ударение на первый гласный окончания
        const totalVowels = (fullForm.match(/[aeiouyěęǫọų]/gi) || []).length;
        const baseVowels = (cleanBase.match(/[aeiouyěęǫọų]/gi) || []).length;

        // Вычисляем индекс слога окончания с конца слова
        const syllableFromEnd = totalVowels - baseVowels - 1;
        const toneType = getAcuteToneType(fullForm, Math.max(0, syllableFromEnd));

        return applyFourTonesMark(fullForm, Math.max(0, syllableFromEnd), toneType);
    }

    // ПАРАДИГМА C (Мобильная): В полных формах прилагательных праславянский циркумфлекс
    // под влиянием местоименной долготы флексий в большинстве падежей ретрагировался на корень.
    if (dbItem.paradigm === AccentParadigm.C) {
        // В Именительном/Винительном падеже ед.ч. сохраняется нисходящий тон (Циркумфлекс) на корне
        const isNomOrAccSg = targetNumber === NumberType.SINGULAR && (targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE);

        if (isNomOrAccSg) {
            const toneType = getCircumflexToneType(fullForm, 1);
            return applyFourTonesMark(fullForm, 1, toneType); // nòv-y (краткий циркумфлекс)
        }

        // В остальных падежах ведет себя как восходящее корневое ударение
        const toneType = getAcuteToneType(fullForm, 1);
        return applyFourTonesMark(fullForm, 1, toneType);
    }

    return fullForm;
}
