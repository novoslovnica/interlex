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
    | 'consonant_s' // консонантные s-основы (nebo)
    | 'consonant_ent' // консонантные ent-основы, детеныши (telę)
    | 'consonant_er'; // консонантные er-основы, термины родства (mati)

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
    const { stemExtension, gender } = item;

    // В БД protoStemClass/stemExtension хранятся как короткие нижнерегистровые
    // славистические коды ('o', 'ā', 'jo', 'i', 'jā', 'u', 'consonant', 'en', 'es', ...),
    // а не как строковые значения enum'ов ProtoStemClass/StemExtension (которые описательные
    // и верхнерегистровые, напр. 'O_SHORT'). Сравнивать нужно с реальными кодами, иначе
    // ни одно настоящее слово из БД никогда не совпадёт (см. AGENTS.md).
    const psc = String(item.protoStemClass).toLowerCase();
    const se = String(stemExtension).toLowerCase();

    // 1. Консонантные основы (по наращению)
    if (psc === 'consonant') {
        if (se === 'en') return 'consonant_n';
        if (se === 'es') return 'consonant_s';
        if (se === 'ent') return 'consonant_ent';
        if (se === 'er') return 'consonant_er';
    }

    // 2. u-основы мужского рода (synъ, domъ)
    if (psc === 'u' && gender === GrammaticalGender.MASC) {
        return 'u_basis';
    }

    // 3. i-основы женского и мужского рода (kostь, gostь)
    if (psc === 'i') {
        return 'i_basis';
    }

    // 4. ā-основы женского и мужского рода (voda, sluga)
    if (psc === 'ā') return 'a_hard';
    if (psc === 'jā') return 'a_soft';

    // 5. o-основы (Разведение по родам для среднего и мужского рода)
    if (psc === 'o') {
        return gender === GrammaticalGender.NEUT ? 'a_hard' : 'o_hard';
    }
    if (psc === 'jo') {
        return gender === GrammaticalGender.NEUT ? 'a_soft' : 'o_soft';
    }

    return 'o_hard'; // Дефолтный безопасный фоллбек для системы
}

// =========================================================================
// 5. ДВИЖОК ЧЕТЫРЕХТОНОВОГО СЛОВОИЗМЕНЕНИЯ И РЕТРАКЦИИ
// =========================================================================

// Наращение основы консонантных существительных (imę→imen-, nebo→nebes-, telę→telent-,
// mati→mater-) — вставляется между основой и окончанием во всех формах, кроме
// им./вин./зв. падежа ед.ч. (там наращение исторически невидимо: "nebo", не "nebeso").
// Исключение — consonant_er: там вин. ед.ч. уже ведёт себя как косвенный падеж ("mater").
const STEM_EXTENSIONS: Partial<Record<StemType, string>> = {
    consonant_n: 'en',
    consonant_s: 'es',
    consonant_ent: 'ent',
    consonant_er: 'er',
};

// consonant_n/consonant_ent имеют ПУСТОЕ окончание им.п. ед.ч. ("ime", "telę") — значит
// последний гласный словарной формы исторически сам является наращением/окончанием,
// а не неизменной частью основы, и его нужно отбросить перед вставкой полного
// наращения в косвенных падежах ("ime" → "im" + "en" + "e" = "imene"). У consonant_s/
// consonant_er окончание им.п. ед.ч. непустое ("nebo", "mati") — переданная основа
// уже "голая" (без гласного наращения), резать её не нужно ("drev" + "es" + "e").
const NOMINATIVE_BLANK_STEM_TYPES: StemType[] = ['consonant_n', 'consonant_ent'];

function stemWithExtension(interslavicWord: string, stemType: StemType, targetCase: Case, targetNumber: NumberType): string {
    const extension = STEM_EXTENSIONS[stemType];
    if (!extension) return interslavicWord;
    const skipCases: Case[] = stemType === 'consonant_er'
        ? [Case.NOMINATIVE, Case.VOCATIVE]
        : [Case.NOMINATIVE, Case.ACCUSATIVE, Case.VOCATIVE];
    if (targetNumber === NumberType.SINGULAR && skipCases.includes(targetCase)) return interslavicWord;
    const base = NOMINATIVE_BLANK_STEM_TYPES.includes(stemType) ? interslavicWord.slice(0, -1) : interslavicWord;
    return base + extension;
}

export function generateBaseNounFormWithFourTones(
    interslavicWord: string,
    paradigm: AccentParadigm,
    stemType: StemType,
    targetCase: Case,
    targetNumber: NumberType,
    flavor: string = 'CORE'
): string {
    const ending = getEnding(stemType, targetNumber, targetCase, flavor);
    const fullForm = stemWithExtension(interslavicWord, stemType, targetCase, targetNumber) + ending;

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
