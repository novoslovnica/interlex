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
import { resolveStressOverride } from '@/lib/grammar/stress';
import { Case, NumberType, StemType } from '@/lib/grammar/endingsRegistry';
import { FourSlavicTones } from '@/lib/grammar/fourTonesGenerator';
import { stripAccents } from '@/lib/grammar/accentUtils';

// =========================================================================
// 1. СТРОГИЕ СИСТЕМНЫЕ ТИПЫ И КАТЕГОРИИ
// Case/NumberType/StemType/FourSlavicTones/stripAccents консолидированы в свои
// канонические места (endingsRegistry.ts/fourTonesGenerator.ts/accentUtils.ts) —
// этот файл (Stack B) реэкспортирует их для обратной совместимости своих
// собственных вызывающих сторон, но больше не объявляет свои копии.
// =========================================================================

export { Case, NumberType, stripAccents };
export type { StemType, FourSlavicTones };

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
    animacy?: string;                   // Одушевлённость (влияет на окончание, напр. Acc.Sg.Masc)
    stressPosition?: number | null;      // Переопределение ударения словом целиком (заимствования)
    morphemes?: { value: string; stressPosition?: number | null }[]; // Переопределение ударным суффиксом/корнем
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

    // gender в БД встречается в двух формах: сокращённой верхнерегистровой ('MASC'/'FEM'/'NEUT',
    // как в enum GrammaticalGender) и полной нижнерегистровой ('masculine'/'feminine'/'neuter') —
    // сравнение по префиксу после lowercase покрывает обе (та же проблема, что уже была
    // исправлена для protoStemClass/stemExtension выше, просто не применена к gender).
    const genderLower = String(gender ?? '').toLowerCase();
    const isMasc = genderLower.startsWith('masc');
    const isNeut = genderLower.startsWith('neut');

    // 1. Консонантные основы (по наращению)
    if (psc === 'consonant') {
        if (se === 'en') return 'consonant_n';
        if (se === 'es') return 'consonant_s';
        if (se === 'ent') return 'consonant_ent';
        if (se === 'er') return 'consonant_er';
    }

    // 2. u-основы мужского рода (synъ, domъ)
    if (psc === 'u' && isMasc) {
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
        return isNeut ? 'a_hard' : 'o_hard';
    }
    if (psc === 'jo') {
        return isNeut ? 'a_soft' : 'o_soft';
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
    flavor: string = 'CORE',
    stressPosition?: number,
    gender?: string,
    animacy?: string,
): string {
    const ending = getEnding(stemType, targetNumber, targetCase, flavor, gender, animacy);
    const fullForm = stemWithExtension(interslavicWord, stemType, targetCase, targetNumber) + ending;

    // ПАРАДИГМА A: Стабильно-восходящее ударение на корне (Долгий/Краткий Акут)
    if (paradigm === AccentParadigm.A) {
        const idx = stressPosition ?? 1;
        const toneType = getAcuteToneType(fullForm, idx);
        return applyFourTonesMark(fullForm, idx, toneType);
    }

    // ПАРАДИГМА B: Окситоническая. При падении еров — ретракция на корень (Неокут)
    if (paradigm === AccentParadigm.B) {
        if (ending === 'ъ' || ending === 'ь' || ending === '') {
            const idx = stressPosition ?? 1;
            const toneType = getAcuteToneType(fullForm, idx);
            return applyFourTonesMark(fullForm, idx, toneType); // bóbъ vs kòńь
        }
        const idx = stressPosition ?? 0;
        const toneType = getAcuteToneType(fullForm, idx);
        return applyFourTonesMark(fullForm, idx, toneType);   // bobá, bobóvъ
    }

    // ПАРАДИГМА C: Подвижная (Циркумфлексы на корне vs Акуты на окончаниях)
    if (paradigm === AccentParadigm.C) {
        const isMasculine = stemType === 'o_hard' || stemType === 'o_soft' || stemType === 'u_basis';
        const isNeuter = stemType === 'a_hard' || stemType === 'a_soft' || stemType === 'consonant_n' || stemType === 'consonant_s';
        const isFeminine = stemType === 'i_basis' || stemType.startsWith('a_');

        // --- А. ЖЕНСКИЙ РОД (rų̂ka [долгий] vs gorȃ [краткий]) ---
        if (isFeminine) {
            if (targetNumber === NumberType.SINGULAR && (targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE)) {
                const idx = stressPosition ?? 1;
                return applyFourTonesMark(fullForm, idx, getCircumflexToneType(fullForm, idx));
            }
            const idx = stressPosition ?? 0;
            return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx));
        }

        // --- Б. МУЖСКОЙ РОД (bȏbъ [краткий циркумфлекс]) ---
        if (isMasculine) {
            if (targetNumber === NumberType.SINGULAR) {
                if (targetCase === Case.NOMINATIVE || targetCase === Case.ACCUSATIVE) {
                    const idx = stressPosition ?? 1;
                    return applyFourTonesMark(fullForm, idx, getCircumflexToneType(fullForm, idx));
                }
                const idx = stressPosition ?? 0;
                return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx)); // Косвенные падежи
            }
            if (targetNumber === NumberType.PLURAL) {
                if (targetCase === Case.ACCUSATIVE) {
                    const idx = stressPosition ?? 1;
                    return applyFourTonesMark(fullForm, idx, getCircumflexToneType(fullForm, idx)); // bóby
                }
                const idx = stressPosition ?? 0;
                return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx));
            }
            const idx = stressPosition ?? 0;
            return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx)); // Дуалис
        }

        // --- В. СРЕДНИЙ РОД (tě̂lo [долгий] vs ȏko [краткий]) ---
        if (isNeuter) {
            if (targetNumber === NumberType.SINGULAR) {
                const idx = stressPosition ?? 1;
                return applyFourTonesMark(fullForm, idx, getCircumflexToneType(fullForm, idx));
            }
            if (targetNumber === NumberType.PLURAL) {
                const idx = stressPosition ?? 0;
                return applyFourTonesMark(fullForm, idx, getAcuteToneType(fullForm, idx)); // telá
            }
            if (targetNumber === NumberType.DUAL) {
                const idx = stressPosition ?? 1;
                return applyFourTonesMark(fullForm, idx, getCircumflexToneType(fullForm, idx)); // tě̂lě
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

    // Переопределение ударения морфемой (ударный суффикс/корень) или словом целиком
    // (заимствования) — та же логика, что и в declineNoun.ts (реальная страница слова).
    const ending = getEnding(stemType, targetNumber, targetCase, flavor ?? 'CORE', dbItem.gender, dbItem.animacy);
    const fullFormForStress = stemWithExtension(dbItem.interslavic, stemType, targetCase, targetNumber) + ending;
    const stressPosition = resolveStressOverride(fullFormForStress, dbItem.morphemes, dbItem.stressPosition) ?? undefined;

    // Шаг 2: Генерация базовой словоформы с расчетом 4 тонов
    const baseAccentedNoun = generateBaseNounFormWithFourTones(
        dbItem.interslavic,
        dbItem.paradigm,
        stemType,
        targetCase,
        targetNumber,
        flavor,
        stressPosition,
        dbItem.gender,
        dbItem.animacy
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
