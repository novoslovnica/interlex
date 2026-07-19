import {
    AccentParadigm,
    GrammaticalGender
} from '@/lib/grammar/common'; // Системные Enum из таблицы Word
import { Case, NumberType, FourSlavicTones, stripAccents } from '../noun';

// =========================================================================
// 1. СТРОГИЕ ИНТЕРФЕЙСЫ И ТИПЫ ДАННЫХ
// =========================================================================

export type NumeralTypeClass = 'one' | 'two_to_four' | 'five_to_ten';

export interface EnhancedNumDbItem {
    interslavic: string;       // Базовая лемма (н-р: "edin", "dva", "pęt")
    protoSlavic: string;
    paradigm: AccentParadigm; // A, B, C
    numClass: NumeralTypeClass; // Новый мета-тег разметки класса числительного
}

export interface NumFormRequest {
    dbItem: EnhancedNumDbItem;
    targetCase: Case;
    targetNumber: NumberType;
    targetGender?: GrammaticalGender; // Опционально (для "три"/"четыре" род не важен)
}

// =========================================================================
// 2. ГЛОБАЛЬНЫЙ РЕЕСТР ОКОНЧАНИЙ ДЛЯ КАТЕГОРИИ "ДВА, ТРИ, ЧЕТЫРЕ"
// =========================================================================

// Числительные 2, 3, 4 используют фиксированные славянские флексии plural/dual
const SMALL_NUMBERS_REGISTRY: Record<'two' | 'three' | 'four', Record<Case, string>> = {
    two: {
        // Для "два" важен род: masc оканчивается на -a, fem/neut на -ě
        [Case.NOMINATIVE]: 'a', [Case.ACCUSATIVE]: 'a', [Case.GENITIVE]: 'oju', [Case.DATIVE]: 'yma', [Case.INSTRUMENTAL]: 'yma', [Case.LOCATIVE]: 'oju', [Case.VOCATIVE]: 'a'
    },
    three: {
        [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ьjъ', [Case.DATIVE]: 'ьmъ', [Case.INSTRUMENTAL]: 'ьmi', [Case.LOCATIVE]: 'ьxъ', [Case.VOCATIVE]: 'e'
    },
    four: {
        [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ьjъ', [Case.DATIVE]: 'ьmъ', [Case.INSTRUMENTAL]: 'ьmi', [Case.LOCATIVE]: 'ьxъ', [Case.VOCATIVE]: 'e'
    }
};

// =========================================================================
// 3. ТОНОВЫЕ ХЕЛПЕРЫ И УТИЛИТЫ ДИАКРИТИКИ
// =========================================================================

function isShortVowel(char: string): boolean {
    return /[oe]/i.test(char);
}

export function applyFourTonesMark(word: string, syllableIndex: number, tone: FourSlavicTones): string {
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

export function getAcuteToneType(word: string, syllableIndex: number): 'long_acute' | 'short_acute' {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_acute';
    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    return isShortVowel(word[targetIndex]) ? 'short_acute' : 'long_acute';
}

export function getCircumflexToneType(word: string, syllableIndex: number): 'long_circumflex' | 'short_circumflex' {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_circumflex';
    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;
    return isShortVowel(word[targetIndex]) ? 'short_circumflex' : 'long_circumflex';
}

// =========================================================================
// 4. ДВИЖОК СКЛОНЕНИЯ И АКЦЕНТУАЦИИ ЧИСЛИТЕЛЬНЫХ
// =========================================================================

export function generateNumeralForm(request: NumFormRequest): string {
    const { dbItem, targetCase, targetNumber, targetGender = GrammaticalGender.MASC } = request;
    const lemma = dbItem.interslavic.toLowerCase().trim();

    let fullForm = lemma;

    // -----------------------------------------------------------------------
    // СТРАТЕГИЯ 1: "ОДИН" (edin) -> Полностью копирует местоименное прилагательное
    // -----------------------------------------------------------------------
    if (dbItem.numClass === 'one') {
        // Подтягиваем реестр из adjectiveEngine динамически, отрезая основу "edin-"
        const cleanBase = lemma === 'edin' ? 'edin' : lemma;
        // Импортируем типы флексий из смежного жесткого реестра hard_adjectives
        const { ADJECTIVE_ENDINGS_REGISTRY } = require('../adjective');
        const ending = ADJECTIVE_ENDINGS_REGISTRY['adj_hard'][targetNumber][targetGender][targetCase];

        // В им.п. мужского рода окончание нулевое (уже сидит в лемме)
        fullForm = (targetCase === Case.NOMINATIVE && targetGender === GrammaticalGender.MASC)
            ? cleanBase
            : cleanBase.replace(/in$/, '') + ending;
    }

        // -----------------------------------------------------------------------
        // СТРАТЕГИЯ 2: "ДВА, ТРИ, ЧЕТЫРЕ" -> Специальные короткие флексии
    // -----------------------------------------------------------------------
    else if (dbItem.numClass === 'two_to_four') {
        if (lemma === 'dva') {
            const base = 'dv';
            const ending = SMALL_NUMBERS_REGISTRY.two[targetCase];
            // Если женский или средний род — праславянское *dvě
            if (ending === 'a' && (targetGender === GrammaticalGender.FEM || targetGender === GrammaticalGender.NEUT)) {
                fullForm = base + 'ě';
            } else {
                fullForm = base + ending;
            }
        } else {
            const numKey = lemma === 'tri' ? 'three' : 'four';
            const base = lemma === 'tri' ? 'tr' : 'četyr';
            const ending = SMALL_NUMBERS_REGISTRY[numKey][targetCase];
            fullForm = base + ending;
        }
    }

        // -----------------------------------------------------------------------
        // СТРАТЕГИЯ 3: "ПЯТЬ - ДЕСЯТЬ" -> Склоняются строго как i-основы существительных (kostь)
    // -----------------------------------------------------------------------
    else if (dbItem.numClass === 'five_to_ten') {
        const { SLAVIC_ENDINGS_REGISTRY } = require('../noun');
        // Все числительные 5-10 женского рода, склоняются строго в Singular
        const ending = SLAVIC_ENDINGS_REGISTRY['i_basis'][NumberType.SINGULAR][targetCase];

        // Отрезаем мягкий знак или исходный носовой элемент для чистой склейки
        const cleanBase = lemma.replace(/[ьъ]$/, '');
        fullForm = cleanBase + ending;
    }

    // =========================================================================
    // ТОНОВАЯ СЕТКА ЗАЛИЗНЯКА ДЛЯ ЧИСЛИТЕЛЬНЫХ
    // =========================================================================

    // ПАРАДИГМА A: Неподвижное ударение на корне
    if (dbItem.paradigm === AccentParadigm.A) {
        return applyFourTonesMark(fullForm, 1, getAcuteToneType(fullForm, 1));
    }

    // ПАРАДИГМА B (Окситонная): Перенос на окончание
    if (dbItem.paradigm === AccentParadigm.B) {
        const totalVowels = (fullForm.match(/[aeiouyěęǫọų]/gi) || []).length;
        if (totalVowels <= 1) {
            return applyFourTonesMark(fullForm, 0, 'short_acute');
        }
        // Если окончание пустое/ер (ъ/ь) — ретракция на корень
        if (fullForm.endsWith('ъ') || fullForm.endsWith('ь') || fullForm.endsWith('')) {
            return applyFourTonesMark(fullForm, 1, getAcuteToneType(fullForm, 1));
        }
        return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0)); // На флексию (pętí)
    }

    // ПАРАДИГМА C (Мобильная): Праславянские энклиномены (два, три, пять — исторически тип C)
    if (dbItem.paradigm === AccentParadigm.C) {
        const isDirectCase = targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE;

        if (isDirectCase) {
            // Именительный и Винительный падежи несут нисходящий циркумфлекс на корне
            return applyFourTonesMark(fullForm, 1, getCircumflexToneType(fullForm, 1)); // dvâ, pę̂tь
        }

        // Косвенные падежи улетают на флексию (восходящий тон)
        return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0)); // dvajų́, pętьjǫ́
    }

    return fullForm;
}
