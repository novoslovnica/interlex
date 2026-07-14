import { StemType, Case, NumberType } from './endingsRegistry';
import { getEnding } from './endingLoader';
import { applyAccent } from './accentUtils';
import {applyPrepositionEnclitic, applyPrepositionEncliticWithFourTones} from './encliticEngine';
import { generateBaseNounFormWithFourTones } from './fourTonesGenerator';
import {EnhancedDbItem, identifyStemTypeByDb} from "@/lib/grammar/stemClassifier";
import {computeStressFromMorphemes, countSyllables} from "@/lib/grammar/stress";

export interface ExtendedWordFormRequest {
    interslavicWord: string;
    paradigm: 'A' | 'B' | 'C';
    stemType: StemType; // Передаем тип основы из нашего реестра
    targetCase: Case;
    targetNumber: NumberType;
}

export function generateAccentedFormExtended(request: ExtendedWordFormRequest): string {
    const { interslavicWord, paradigm, stemType, targetCase, targetNumber } = request;

    // 1. Получаем флексию из реестра классов (с возможностью перегрузки из БД)
    const ending = getEnding(stemType, targetNumber, targetCase);
    const fullForm = interslavicWord + ending;

    // ПАРАДИГМА A: Абсолютно неподвижное ударение на корне для всех родов
    if (paradigm === 'A') {
        return applyAccent(fullForm, 1);
    }

    // ПАРАДИГМА B (Окситонная):
    if (paradigm === 'B') {
        // Особое правило: если окончание состоит только из ера (ъ/ь),
        // ударение физически не может на него упасть и переносится на корень (последний слог корня)
        if (ending === 'ъ' || ending === 'ь') {
            return applyAccent(fullForm, 1); // bóbъ, końь
        }
        // В остальных случаях — строго на окончание
        return applyAccent(fullForm, 0); // bobá, końá, bobóvъ
    }

    // ПАРАДИГМА C (Подвижная):
    if (paradigm === 'C') {
        const isMasculine = stemType === 'o_hard' || stemType === 'o_soft';
        const isNeuter = stemType === 'a_hard' || stemType === 'a_soft';

        // --- ЛОГИКА ДЛЯ МУЖСКОГО РОДА ТИПА C ---
        if (isMasculine) {
            if (targetNumber === 'singular') {
                if (targetCase === 'nominative' || targetCase === 'accusative') {
                    return applyAccent(fullForm, 1); // Ударение на корень: bóbъ, bóbъ
                }
                return applyAccent(fullForm, 0);   // Косвенные падежи на окончание: bobá, bobú
            }

            if (targetNumber === 'plural') {
                if (targetCase === 'accusative') {
                    return applyAccent(fullForm, 1); // Особое правило мужского рода: Acc.Pl на корень (bóby)
                }
                return applyAccent(fullForm, 0);   // Остальные на окончание (bobí, bobómъ)
            }

            if (targetNumber === 'dual') {
                return applyAccent(fullForm, 0);   // В дуалисе у мужского рода o-основ ударение на окончании: bobá
            }
        }

        // --- ЛОГИКА ДЛЯ СРЕДНЕГО РОДА ТИПА C (Пример: *tělo) ---
        if (isNeuter) {
            if (targetNumber === 'singular') {
                // В единственном числе среднего рода ударение всегда на корне
                return applyAccent(fullForm, 1); // tě́lo, tě́la, tě́lu
            }
            if (targetNumber === 'plural') {
                // Во множественном числе среднего рода типа C ударение прыгает на окончание!
                return applyAccent(fullForm, 0); // telá (окна, тела)
            }
            if (targetNumber === 'dual') {
                return applyAccent(fullForm, 1); // В дуалисе возвращается на корень: tě́lě
            }
        }

        // --- ЛОГИКА ДЛЯ i-ОСНОВ (kostь, gostь) ---
        if (stemType === 'i_basis') {
            if (targetNumber === 'singular') {
                if (targetCase === 'nominative' || targetCase === 'accusative') {
                    return applyAccent(fullForm, 1); // На корень: kóstь
                }
                return applyAccent(fullForm, 0);   // На флексию: kostí, kostьjǫ́
            }
            if (targetNumber === 'plural' || targetNumber === 'dual') {
                return applyAccent(fullForm, 0);   // Почти весь плирулис и дуалис улетает на флексию: kostí, kostьmъ́
            }
        }

        // --- ЛОГИКА ДЛЯ u-ОСНОВ (synъ, domъ) ---
        if (stemType === 'u_basis') {
            if (targetNumber === 'singular') {
                if (targetCase === 'nominative' || targetCase === 'accusative') {
                    return applyAccent(fullForm, 1); // sýnъ
                }
                return applyAccent(fullForm, 0);   // synú, synoví
            }
            if (targetNumber === 'plural') {
                if (targetCase === 'nominative') {
                    // Ударение на суффикс наращения основы -ove
                    return applyAccent(fullForm, 1); // synov́e (предпоследний слог полной формы)
                }
                return applyAccent(fullForm, 0);   // synóvъ, syný
            }
        }

        // --- ЛОГИКА ДЛЯ КОНСОНАНТНЫХ ОСНОВ (imę, nebo) ---
        if (stemType === 'consonant_n' || stemType === 'consonant_s') {
            if (targetNumber === 'singular') {
                // Единственное число консонантных основ типа C держит ударение на корне основы
                return applyAccent(fullForm, 1); // nébo, nébese, íme, ímene
            }
            if (targetNumber === 'plural') {
                // Множественное число резко переносит акцент на конечную флексию
                return applyAccent(fullForm, 0); // nebesá, imená
            }
            if (targetNumber === 'dual') {
                return applyAccent(fullForm, 1); // Дуалис сохраняет корень: nébesě
            }
        }
    }

    return fullForm;
}

// 1. Единый интерфейс для запроса формы
export interface IntegratedFormRequest {
    interslavicWord: string; // Базовое междуславянское слово (например: "ruka")
    paradigm: 'A' | 'B' | 'C';
    stemType: StemType;
    targetCase: Case;
    targetNumber: NumberType;
    preposition?: string;    // Опциональный предлог (например: "na", "okolo")
}

/**
 * ЭТАП 1: Базовый генератор падежной формы существительного с внутренним ударением
 */
function generateBaseNounForm(request: IntegratedFormRequest): string {
    const { interslavicWord, paradigm, stemType, targetCase, targetNumber } = request;

    // Извлекаем окончание из нашего реестра классов
    const ending = getEnding(stemType, targetNumber, targetCase);
    const fullForm = interslavicWord + ending;

    // ПАРАДИГМА A: Неподвижное ударение на корне
    if (paradigm === 'A') {
        return applyAccent(fullForm, 1);
    }

    // ПАРАДИГМА B (Окситонная): На окончание, кроме падения еров
    if (paradigm === 'B') {
        if (ending === 'ъ' || ending === 'ь' || ending === '') {
            return applyAccent(fullForm, 1); // Перенос на корень (bóbъ)
        }
        return applyAccent(fullForm, 0);   // На окончание (bobá)
    }

    // ПАРАДИГМА C (Подвижная): Внутренние прыжки ударения
    if (paradigm === 'C') {
        const isMasculine = stemType === 'o_hard' || stemType === 'o_soft' || stemType === 'u_basis';
        const isNeuter = stemType === 'a_hard' || stemType === 'a_soft' || stemType === 'consonant_n' || stemType === 'consonant_s';
        const isFeminine = stemType === 'i_basis' || stemType.startsWith('a_'); // грубое разделение для теста

        if (isFeminine) {
            if (targetNumber === 'singular' && targetCase === 'accusative') return applyAccent(fullForm, 1); // rǫ́kۆ
            if (targetNumber === 'singular') return applyAccent(fullForm, 0); // ruký, rukě́
            return applyAccent(fullForm, 0); // во мн. и дв. числе уходит на флексию
        }

        if (isMasculine) {
            if (targetNumber === 'singular' && (targetCase === 'nominative' || targetCase === 'accusative')) return applyAccent(fullForm, 1);
            if (targetNumber === 'plural' && targetCase === 'accusative') return applyAccent(fullForm, 1); // bóby
            return applyAccent(fullForm, 0); // косвенные падежи на окончание
        }

        if (isNeuter) {
            if (targetNumber === 'singular') return applyAccent(fullForm, 1); // tě́lo
            if (targetNumber === 'plural') return applyAccent(fullForm, 0);   // telá
            if (targetNumber === 'dual') return applyAccent(fullForm, 1);     // tě́lě
        }
    }

    return fullForm;
}

/**
 * 🔥 ГЛАВНАЯ ИНТЕГРАЦИОННАЯ ФУНКЦИЯ СЛОВАРЯ
 * Запускает полный цикл: Склонение -> Акцентуация существительного -> Ретракция на предлог
 */
export function declineNoun(request: IntegratedFormRequest): string {
    // Шаг 1: Генерируем стандартную падежную форму существительного с ударением
    const accentedNoun = generateBaseNounForm(request);

    // Шаг 2: Если предлог не передан, просто возвращаем существительное
    if (!request.preposition) {
        return accentedNoun;
    }

    // Шаг 3: Если предлог есть, прогоняем через движок энклитик
    return applyPrepositionEnclitic({
        preposition: request.preposition,
        accentedNounForm: accentedNoun,
        paradigm: request.paradigm,
        targetCase: request.targetCase as 'nominative' | 'accusative' | 'genitive' | 'dative' | 'instrumental' | 'locative',
        targetNumber: request.targetNumber
    });
}

export interface IntegratedNounRequest {
    interslavicWord: string;
    paradigm: 'A' | 'B' | 'C';
    stemType: any; // Наш StemType из реестра флексий
    targetCase: any;
    targetNumber: any;
    preposition?: string;
}

/**
 * Полный цикл генерации: Склонение -> Наложение 1 из 4 тонов -> Перенос на клитику
 */
export function declineNounWithFourTones(request: IntegratedNounRequest): string {
    // 1. Генерируем базовое слово с точной оценкой краткости/долготы и тона
    const baseAccentedNoun = generateBaseNounFormWithFourTones(
        request.interslavicWord,
        request.paradigm,
        request.stemType,
        request.targetCase,
        request.targetNumber
    );

    // 2. Если предлога нет — возвращаем форму
    if (!request.preposition) {
        return baseAccentedNoun;
    }

    // 3. Если предлог есть — передаем в обновленный движок клитик
    return applyPrepositionEncliticWithFourTones({
        preposition: request.preposition,
        accentedNounForm: baseAccentedNoun,
        paradigm: request.paradigm,
        targetCase: request.targetCase,
        targetNumber: request.targetNumber
    });
}

export interface FinalUserRequest {
    dbItem: EnhancedDbItem; // Передаем объект прямо из сгенерированного JSON
    targetCase: 'nominative' | 'accusative' | 'genitive' | 'dative' | 'instrumental' | 'locative' | 'vocative';
    targetNumber: 'singular' | 'plural' | 'dual';
    preposition?: string;
}

/**
 * Главная точка входа автоматического словаря акцентуированных форм
 */
export function declineWordAutomatically(request: FinalUserRequest): string {
    const { dbItem, targetCase, targetNumber, preposition } = request;

    // 1. Автоматически вычисляем класс склонения по метаданным из базы
    const stemType = identifyStemTypeByDb(dbItem);

    // 2. Вычисляем позицию ударения: морфемы → stressPosition на лексеме → penultimate
    const ending = getEnding(stemType, targetNumber, targetCase, 'CORE', dbItem.gender, dbItem.animacy);
    const fullForm = dbItem.interslavic + ending;

    let effectiveStressPosition: number | undefined = undefined;
    if (dbItem.paradigm === 'A') {
        const fromMorphemes = dbItem.morphemes
            ? computeStressFromMorphemes(fullForm, dbItem.morphemes)
            : null;
        const stressFromStart = fromMorphemes ?? dbItem.stressPosition ?? null;
        if (stressFromStart != null) {
            const total = countSyllables(fullForm);
            effectiveStressPosition = total - 1 - stressFromStart;
        }
    }

    // 3. Генерируем форму с точным расчетом одного из 4 тонов Зализняка
    const baseAccentedNoun = generateBaseNounFormWithFourTones(
        dbItem.interslavic,
        dbItem.paradigm,
        stemType,
        targetCase,
        targetNumber,
        effectiveStressPosition,
        dbItem.gender,
        dbItem.animacy,
    );

    // 4. Если предлога нет — возвращаем форму
    if (!preposition) {
        return baseAccentedNoun;
    }

    // 5. Если предлог есть — прогоняем через тоновый движок клитик
    return applyPrepositionEncliticWithFourTones({
        preposition,
        accentedNounForm: baseAccentedNoun,
        paradigm: dbItem.paradigm,
        targetCase,
        targetNumber
    });
}

