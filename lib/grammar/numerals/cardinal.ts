import {
    AccentParadigm,
    GrammaticalGender
} from '@/lib/grammar/common'; // Системные Enum из таблицы Word
import { Case, NumberType, FourSlavicTones, stripAccents } from '../noun';
import { getEnding, getEndingByGrammeme } from '@/lib/grammar/endingLoader';
import { buildGrammeme } from '@/lib/grammar/grammemes';
import { ADJECTIVE_ENDINGS_REGISTRY } from '@/lib/grammar/adjective';
import { SLAVIC_ENDINGS_REGISTRY } from '@/lib/grammar/endingsRegistry';
import { normalizeSoftConsonants, collapseDoubleJ } from '@/lib/isv';
import { resolveStressOverride } from '@/lib/grammar/stress';

// =========================================================================
// 1. СТРОГИЕ ИНТЕРФЕЙСЫ И ТИПЫ ДАННЫХ
// =========================================================================

export type NumeralTypeClass = 'one' | 'two_to_four' | 'five_to_ten';

export interface EnhancedNumDbItem {
    interslavic: string;       // Базовая лемма (н-р: "edin", "dva", "pęt")
    protoSlavic: string;
    paradigm: AccentParadigm; // A, B, C
    numClass: NumeralTypeClass; // Новый мета-тег разметки класса числительного
    stressPosition?: number | null;      // Переопределение ударения словом целиком (заимствования)
    morphemes?: { value: string; stressPosition?: number | null }[]; // Переопределение ударным суффиксом/корнем
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
        [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ej', [Case.DATIVE]: 'em', [Case.INSTRUMENTAL]: 'emi', [Case.LOCATIVE]: 'eh', [Case.VOCATIVE]: 'e'
    },
    four: {
        [Case.NOMINATIVE]: 'e', [Case.ACCUSATIVE]: 'i', [Case.GENITIVE]: 'ej', [Case.DATIVE]: 'em', [Case.INSTRUMENTAL]: 'emi', [Case.LOCATIVE]: 'eh', [Case.VOCATIVE]: 'e'
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
    // Окончание, реально использованное ниже — проверяем его напрямую для тоновой
    // сетки Парадигмы B, а не конец fullForm (см. комментарий там же).
    let usedEnding = '';

    // -----------------------------------------------------------------------
    // СТРАТЕГИЯ 1: "ОДИН" (edin) -> Полностью копирует местоименное прилагательное
    // -----------------------------------------------------------------------
    if (dbItem.numClass === 'one') {
        const cleanBase = lemma === 'edin' ? 'edin' : lemma;
        const dbEnding = getEnding('adj_hard', targetNumber, targetCase, 'CORE', targetGender === GrammaticalGender.FEM ? 'Fem' : targetGender === GrammaticalGender.NEUT ? 'Neut' : 'Masc');
        const ending = dbEnding || ADJECTIVE_ENDINGS_REGISTRY['adj_hard'][targetNumber][targetGender][targetCase];
        usedEnding = ending;

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
            const grammeme = buildGrammeme(targetCase, NumberType.DUAL);
            const dbEnding = getEndingByGrammeme('numeral_two', grammeme);
            const ending = dbEnding ?? SMALL_NUMBERS_REGISTRY.two[targetCase];
            usedEnding = ending;
            if (ending === 'a' && (targetGender === GrammaticalGender.FEM || targetGender === GrammaticalGender.NEUT)) {
                fullForm = base + 'ě';
            } else {
                fullForm = base + ending;
            }
        } else {
            const numKey = lemma === 'tri' ? 'three' : 'four';
            const stemType = lemma === 'tri' ? 'numeral_three' : 'numeral_four';
            const base = lemma === 'tri' ? 'tr' : 'četyr';
            const grammeme = buildGrammeme(targetCase, NumberType.PLURAL);
            const dbEnding = getEndingByGrammeme(stemType, grammeme);
            const ending = dbEnding ?? SMALL_NUMBERS_REGISTRY[numKey][targetCase];
            usedEnding = ending;
            fullForm = base + ending;
        }
    }

        // -----------------------------------------------------------------------
        // СТРАТЕГИЯ 3: "ПЯТЬ - ДЕСЯТЬ" -> Склоняются строго как i-основы существительных (kostь).
        // Ном./Вин. ед.ч. у i-основ реализуются самой финальной мягкой согласной
        // леммы (pęť, noć) — окончание 'j' для них избыточно и убирается ниже тем
        // же правилом, что и для существительных (lib/isv.ts normalizeSoftConsonants).
        // Перед остальными (гласными) окончаниями финальная мягкая согласная,
        // наоборот, переходит в обычный вид — гласная сама несёт палатализацию.
    // -----------------------------------------------------------------------
    else if (dbItem.numClass === 'five_to_ten') {
        const dbEnding = getEnding('i_basis', NumberType.SINGULAR, targetCase, 'CORE');
        const ending = dbEnding !== '' ? dbEnding : SLAVIC_ENDINGS_REGISTRY['i_basis'][NumberType.SINGULAR][targetCase];
        usedEnding = ending;

        const cleanBase = lemma.replace(/[ьъ]$/, '');
        fullForm = cleanBase + ending;
    }

    // Убираем задвоенную мягкость перед тоновой разметкой (pęťj -> pęť, noći -> noči)
    fullForm = collapseDoubleJ(normalizeSoftConsonants(fullForm));
    // =========================================================================
    // ТОНОВАЯ СЕТКА ЗАЛИЗНЯКА ДЛЯ ЧИСЛИТЕЛЬНЫХ
    // =========================================================================

    // Переопределение ударения морфемой (ударный суффикс/корень) или словом целиком
    // (заимствования) — переопределяет только СЛОГ, тип тона решает парадигма ниже.
    const override = resolveStressOverride(fullForm, dbItem.morphemes, dbItem.stressPosition) ?? undefined;

    // ПАРАДИГМА A: Неподвижное ударение на корне
    if (dbItem.paradigm === AccentParadigm.A) {
        const idx = override ?? 1;
        return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx));
    }

    // ПАРАДИГМА B (Окситонная): Перенос на окончание
    if (dbItem.paradigm === AccentParadigm.B) {
        const totalVowels = (fullForm.match(/[aeiouyěęǫọų]/gi) || []).length;
        if (totalVowels <= 1) {
            return applyFourTonesMark(fullForm, 0, 'short_acute');
        }
        // Если окончание пустое/ер (ъ/ь) — ретракция на корень. Проверяем именно
        // значение выбранного окончания, а не конец fullForm: endsWith('') всегда
        // true в JS, так что прежняя проверка была фактически тавтологией.
        if (usedEnding === '' || usedEnding === 'ъ' || usedEnding === 'ь') {
            const idx = override ?? 1;
            return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx));
        }
        const idx = override ?? 0;
        return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx)); // На флексию (pętí)
    }

    // ПАРАДИГМА C (Мобильная): Праславянские энклиномены (два, три, пять — исторически тип C)
    if (dbItem.paradigm === AccentParadigm.C) {
        const isDirectCase = targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE;

        if (isDirectCase) {
            // Именительный и Винительный падежи несут нисходящий циркумфлекс на корне
            const idx = override ?? 1;
            return applyFourTonesMark(fullForm, idx, getCircumflexToneType(fullForm, idx)); // dvâ, pę̂tь
        }

        // Косвенные падежи улетают на флексию (восходящий тон)
        const idx = override ?? 0;
        return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx)); // dvajų́, pętьjǫ́
    }

    return fullForm;
}
