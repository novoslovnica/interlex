import {
    AccentParadigm,
    GrammaticalGender
} from '@/types/morphology'; // Системные Enum из таблицы Word
import { Case, NumberType, FourSlavicTones, stripAccents } from './nounEngine';

// =========================================================================
// 1. СТРОГИЕ ИНТЕРФЕЙСЫ И ТИПЫ ДАННЫХ
// =========================================================================

export type PronounClass = 'personal' | 'demonstrative_who_what';

export interface EnhancedPronounDbItem {
    interslavic: string;       // Словарная форма (н-р: "ja", "ty", "kto", "čto", "on")
    protoSlavic: string;
    paradigm: AccentParadigm; // A, B, C
    pronClass: PronounClass;  // Классификатор типа местоимения
}

export interface PronounFormRequest {
    dbItem: EnhancedPronounDbItem;
    targetCase: Case;
    targetNumber: NumberType;
    targetGender?: GrammaticalGender; // Важно для местоимений 3-го лица (on, ona, ono)
    isEnclitic?: boolean;             // Флаг запроса краткой формы (н-р: mę вместо mene)
}

// =========================================================================
// 2. РЕЕСТРЫ ФЛЕКСИЙ И СУППЛЕТИВНЫХ ОСНОВ МЕСТОИМЕНИЙ
// =========================================================================

// База полных и кратких форм для личных местоимений (Супплетивные сетки)
const PERSONAL_PRONOUNS_REGISTRY: Record<string, Record<NumberType, Record<Case, { full: string; short?: string }>>> = {
    ja: {
        [NumberType.SINGULAR]: {
            [Case.NOMINATIVE]: { full: 'ja' },
            [Case.ACCUSATIVE]: { full: 'mene', short: 'mę' },
            [Case.GENITIVE]: { full: 'mene', short: 'mę' },
            [Case.DATIVE]: { full: 'meně', short: 'mi' },
            [Case.INSTRUMENTAL]: { full: 'mьnojǫ' },
            [Case.LOCATIVE]: { full: 'mьně' },
            [Case.VOCATIVE]: { full: 'ja' }
        },
        [NumberType.PLURAL]: {
            [Case.NOMINATIVE]: { full: 'my' }, [Case.ACCUSATIVE]: { full: 'nasъ', short: 'ny' }, [Case.GENITIVE]: { full: 'nasъ' }, [Case.DATIVE]: { full: 'namъ' }, [Case.INSTRUMENTAL]: { full: 'nami' }, [Case.LOCATIVE]: { full: 'nasъ' }, [Case.VOCATIVE]: { full: 'my' }
        },
        [NumberType.DUAL]: {
            [Case.NOMINATIVE]: { full: 'vě' }, [Case.ACCUSATIVE]: { full: 'na' }, [Case.GENITIVE]: { full: 'naju' }, [Case.DATIVE]: { full: 'nama' }, [Case.INSTRUMENTAL]: { full: 'nama' }, [Case.LOCATIVE]: { full: 'naju' }, [Case.VOCATIVE]: { full: 'vě' }
        }
    },
    ty: {
        [NumberType.SINGULAR]: {
            [Case.NOMINATIVE]: { full: 'ty' },
            [Case.ACCUSATIVE]: { full: 'tebe', short: 'tę' },
            [Case.GENITIVE]: { full: 'tebe', short: 'tę' },
            [Case.DATIVE]: { full: 'tobě', short: 'ti' },
            [Case.INSTRUMENTAL]: { full: 'tobojǫ' },
            [Case.LOCATIVE]: { full: 'tobě' },
            [Case.VOCATIVE]: { full: 'ty' }
        },
        [NumberType.PLURAL]: {
            [Case.NOMINATIVE]: { full: 'vy' }, [Case.ACCUSATIVE]: { full: 'vasъ', short: 'vy' }, [Case.GENITIVE]: { full: 'vasъ' }, [Case.DATIVE]: { full: 'vamъ' }, [Case.INSTRUMENTAL]: { full: 'vami' }, [Case.LOCATIVE]: { full: 'vasъ' }, [Case.VOCATIVE]: { full: 'vy' }
        },
        [NumberType.DUAL]: {
            [Case.NOMINATIVE]: { full: 'va' }, [Case.ACCUSATIVE]: { full: 'va' }, [Case.GENITIVE]: { full: 'vaju' }, [Case.DATIVE]: { full: 'vama' }, [Case.INSTRUMENTAL]: { full: 'vama' }, [Case.LOCATIVE]: { full: 'vaju' }, [Case.VOCATIVE]: { full: 'va' }
        }
    }
};

// Сетка неличных вопросительных местоимений (kto/čto)
const INTERROGATIVE_PRONOUNS: Record<'kto' | 'čto', Record<Case, string>> = {
    kto: {
        [Case.NOMINATIVE]: 'kto', [Case.ACCUSATIVE]: 'kogo', [Case.GENITIVE]: 'kogo', [Case.DATIVE]: 'komu', [Case.INSTRUMENTAL]: 'kěmь', [Case.LOCATIVE]: 'komь', [Case.VOCATIVE]: 'kto'
    },
    čto: {
        [Case.NOMINATIVE]: 'čto', [Case.ACCUSATIVE]: 'čto', [Case.GENITIVE]: 'česo', [Case.DATIVE]: 'čemu', [Case.INSTRUMENTAL]: 'čimь', [Case.LOCATIVE]: 'čemь', [Case.VOCATIVE]: 'čto'
    }
};

// =========================================================================
// 3. НИЗКОУРОВНЕВАЯ ТОНОВАЯ АВТОМАТИКА ДИАКРИТИКИ
// =========================================================================

function isShortVowel(char: string): boolean {
    return /[oe]/i.test(char);
}

function applyFourTonesMark(word: string, syllableIndex: number, tone: FourSlavicTones): string {
    const vowels = /[aeiouyěęǫọųьmъ]/gi; // Включаем редуцированные, способные нести праславянский слоговой тон
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
    const vowels = /[aeiouyěęǫọųьъ]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_acute';
    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    return isShortVowel(word[targetIndex]) ? 'short_acute' : 'long_acute';
}

function getCircumflexToneType(word: string, syllableIndex: number): 'long_circumflex' | 'short_circumflex' {
    const vowels = /[aeiouyěęǫọųьъ]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_circumflex';
    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    return isShortVowel(word[targetIndex]) ? 'short_circumflex' : 'long_circumflex';
}

// =========================================================================
// 4. ДВИЖОК СКЛОНЕНИЯ И ТОНИРОВАНИЯ МЕСТОИМЕНИЙ
// =========================================================================

export function generatePronounForm(request: PronounFormRequest): string {
    const { dbItem, targetCase, targetNumber, targetGender = GrammaticalGender.MASC, isEnclitic = false } = request;
    const lemma = dbItem.interslavic.toLowerCase().trim();

    let rawForm = lemma;

    // -----------------------------------------------------------------------
    // СТРАТЕГИЯ 1: ЛИЧНЫЕ МЕСТОИМЕНИЯ (ja, ty)
    // -----------------------------------------------------------------------
    if (dbItem.pronClass === 'personal' && (lemma === 'ja' || lemma === 'ty')) {
        const cell = PERSONAL_PRONOUNS_REGISTRY[lemma][targetNumber][targetCase];
        rawForm = (isEnclitic && cell.short) ? cell.short : cell.full;

        // КРАТКИЕ ФОРМЫ (энклитики типа mę, mi, ti) ФИЗИЧЕСКИ БЕЗУДАРНЫ
        if (isEnclitic && cell.short) {
            return rawForm;
        }
    }

        // -----------------------------------------------------------------------
        // СТРАТЕГИЯ 2: ВОПРОСИТЕЛЬНЫЕ / ОТНОСИТЕЛЬНЫЕ (kto, čto)
    // -----------------------------------------------------------------------
    else if (dbItem.pronClass === 'demonstrative_who_what' && (lemma === 'kto' || lemma === 'čto')) {
        rawForm = INTERROGATIVE_PRONOUNS[lemma as 'kto' | 'čto'][targetCase];
    }

        // -----------------------------------------------------------------------
        // СТРАТЕГИЯ 3: УКАЗАТЕЛЬНЫЕ / РОДОВЫЕ МЕСТОИМЕНИЯ (on, ona, ono)
    // -----------------------------------------------------------------------
    else if (lemma === 'on') {
        // Местоимение 3-го лица в косвенных падежах образует супплетивную основу *j- (jego, jemu...)
        const isDirect = targetCase === Case.NOMINATIVE || (targetCase === Case.ACCUSATIVE && targetGender === GrammaticalGender.NEUT);

        if (isDirect) {
            if (targetGender === GrammaticalGender.FEM) rawForm = 'ona';
            else if (targetGender === GrammaticalGender.NEUT) rawForm = 'ono';
            else rawForm = 'on';
        } else {
            // Подтягиваем окончания мягкого адъективного типа (adj_soft) из adjectiveEngine
            const { ADJECTIVE_ENDINGS_REGISTRY } = require('./adjectiveEngine');
            const ending = ADJECTIVE_ENDINGS_REGISTRY['adj_soft'][targetNumber][targetGender][targetCase];

            // Основа анафорического местоимения в косвенных падежах — праславянский йот (*j-)
            rawForm = 'j' + ending;
        }
    }

    // =========================================================================
    // ТОНОВЫЕ ПРАВИЛА ЗАЛИЗНЯКА И СЛАВЯНСКАЯ АКЦЕНТОЛОГИЯ МЕСТОИМЕНИЙ
    // =========================================================================

    // ПАРАДИГМА A (Стационарная): Ударение строго фиксировано на корне
    if (dbItem.paradigm === AccentParadigm.A) {
        return applyFourTonesMark(rawForm, 1, getAcuteToneType(rawForm, 1));
    }

    // ПАРАДИГМА B (Окситонная): Местоимения типа *kto, *čto, *on исторически окситонировались
    if (dbItem.paradigm === AccentParadigm.B) {
        // В коротких закрытых падежах на редуцированные (ъ/ь) — ретракция на корень
        if (rawForm.endsWith('ъ') || rawForm.endsWith('ь') || rawForm.length <= 3) {
            return applyFourTonesMark(rawForm, 1, getAcuteToneType(rawForm, 1)); // kòstь, tъ̀
        }
        // В остальных падежах — восходящее ударение на окончание (kogá, jemú)
        return applyFourTonesMark(rawForm, 0, getAcuteToneType(rawForm, 0));
    }

    // ПАРАДИГМА C (Мобильная): Личные местоимения (ja, ty) — абсолютные энклиномены
    if (dbItem.paradigm === AccentParadigm.C) {
        const isDirectCase = targetCase === Case.NOMINATIVE || targetCase === Case.VOCATIVE;

        if (isDirectCase) {
            // Именительный падеж личных местоимений несет нисходящий циркумфлекс (jâ, tŷ)
            return applyFourTonesMark(rawForm, 1, getCircumflexToneType(rawForm, 1));
        }

        // В полных косвенных падежах (mene, tebe, tobě) ударение падает на окончание (восходящий тон)
        return applyFourTonesMark(rawForm, 0, getAcuteToneType(rawForm, 0)); // mené, tebé
    }

    return rawForm;
}
