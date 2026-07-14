import { StemType, Case, NumberType, SLAVIC_ENDINGS_REGISTRY } from './endingsRegistry';

// Четыре строгих академических тона
export type FourSlavicTones = 'long_acute' | 'short_acute' | 'long_circumflex' | 'short_circumflex';

/**
 * Вспомогательная функция определения изначальной краткости гласного (o / e)
 */
function isShortVowel(char: string): boolean {
    return /[oe]/i.test(char);
}

/**
 * Универсальная утилита простановки одного из четырех тонов на конкретный слог
 * @param word Полное слово (основа + окончание)
 * @param syllableIndex Индекс слога с конца (0 - последний, 1 - предпоследний)
 * @param tone Категория тона по системе Зализняка
 */
function applyFourTonesMark(word: string, syllableIndex: number, tone: FourSlavicTones): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));

    if (matches.length === 0) return word;

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    const char = word[targetIndex];
    let unicodeMark = '\u0301'; // По умолчанию долгий акут

    switch (tone) {
        case 'long_acute':
            unicodeMark = '\u0301'; // Акут (́)
            break;
        case 'short_acute':
            unicodeMark = '\u0300'; // Гравис (̀)
            break;
        case 'long_circumflex':
            unicodeMark = '\u0302'; // Циркумфлекс (̂)
            break;
        case 'short_circumflex':
            unicodeMark = '\u0311'; // Перевернутая дуга / Краткий нисходящий (̑)
            break;
    }

    return word.substring(0, targetIndex) + char + unicodeMark + word.substring(targetIndex + 1);
}

/**
 * Автоматически определяет, какой тон (долгий или краткий) применить для восходящего ударения (Acute)
 */
function getAcuteToneType(word: string, syllableIndex: number): 'long_acute' | 'short_acute' {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_acute';

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    return isShortVowel(word[targetIndex]) ? 'short_acute' : 'long_acute';
}

/**
 * Автоматически определяет, какой тон (долгий или краткий) применить для нисходящего ударения (Circumflex)
 */
function getCircumflexToneType(word: string, syllableIndex: number): 'long_circumflex' | 'short_circumflex' {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));
    if (matches.length === 0) return 'long_circumflex';

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    return isShortVowel(word[targetIndex]) ? 'short_circumflex' : 'long_circumflex';
}

/**
 * 🔥 ДВИЖОК ПОЛНОЙ ЧЕТЫРЕХТОНОВОЙ АКЦЕНТУАЦИИ СУЩЕСТВЕННЫХ
 */
export function generateBaseNounFormWithFourTones(
    interslavicWord: string,
    paradigm: 'A' | 'B' | 'C',
    stemType: StemType,
    targetCase: Case,
    targetNumber: NumberType,
    stressPosition?: number,
): string {

    const ending = SLAVIC_ENDINGS_REGISTRY[stemType][targetNumber][targetCase];
    const fullForm = interslavicWord + ending;

    // =========================================================================
    // ПАРАДИГМА A: Восходящее ударение на корне.
    // Дифференцируется на ДОЛГИЙ АКУТ (́) и КРАТКИЙ АКУТ (̀) в зависимости от гласной.
    // =========================================================================
    if (paradigm === 'A') {
        const effectiveStressPosition = stressPosition ?? 1;
        const toneType = getAcuteToneType(fullForm, effectiveStressPosition);
        return applyFourTonesMark(fullForm, effectiveStressPosition, toneType);
    }

    // =========================================================================
    // ПАРАДИГМА B: Восходящее ударение. На окончаниях — долгий/краткий акут.
    // При падении еров уходит на корень (Неокут): если корень краткий (o/e) -> Краткий акут (̀)
    // =========================================================================
    if (paradigm === 'B') {
        if (ending === 'ъ' || ending === 'ь' || ending === '') {
            const toneType = getAcuteToneType(fullForm, 1); // Неокутовый тон на корне
            return applyFourTonesMark(fullForm, 1, toneType); // bóbъ (долгий) vs kòńь (краткий неокут)
        }
        const toneType = getAcuteToneType(fullForm, 0); // Тон на окончании
        return applyFourTonesMark(fullForm, 0, toneType);   // žená (долгий) vs ženě̀ (краткий)
    }

    // =========================================================================
    // ПАРАДИГМА C: Нисходящее ударение на корне (энклиномены), восходящее на окончаниях.
    // =========================================================================
    if (paradigm === 'C') {
        const isMasculine = stemType === 'o_hard' || stemType === 'o_soft' || stemType === 'u_basis';
        const isNeuter = stemType === 'a_hard' || stemType === 'a_soft' || stemType === 'consonant_n' || stemType === 'consonant_s';
        const isFeminine = stemType === 'i_basis' || stemType.startsWith('a_');

        // --- А. ЖЕНСКИЙ РОД (Примеры: rų̂ka [долгий циркумфлекс] vs gorȃ [краткий циркумфлекс]) ---
        if (isFeminine) {
            if (targetNumber === 'singular' && (targetCase === 'nominative' || targetCase === 'accusative')) {
                const toneType = getCircumflexToneType(fullForm, 1);
                return applyFourTonesMark(fullForm, 1, toneType); // rų̂ka (долгий ̂) vs goȓa (краткий ̑)
            }
            const toneType = getAcuteToneType(fullForm, 0);
            return applyFourTonesMark(fullForm, 0, toneType); // На флексиях всегда восходящее: ruký
        }

        // --- Б. МУЖСКОЙ РОД (Примеры: bоbъ -> bȏbъ [краткий циркумфлекс]) ---
        if (isMasculine) {
            if (targetNumber === 'singular') {
                if (targetCase === 'nominative' || targetCase === 'accusative') {
                    const toneType = getCircumflexToneType(fullForm, 1);
                    return applyFourTonesMark(fullForm, 1, toneType); // bȏbъ (краткий циркумфлекс U+0311 на 'o')
                }
                const toneType = getAcuteToneType(fullForm, 0);
                return applyFourTonesMark(fullForm, 0, toneType); // bobá (косвенные падежи)
            }
            if (targetNumber === 'plural') {
                if (targetCase === 'accusative') {
                    const toneType = getCircumflexToneType(fullForm, 1);
                    return applyFourTonesMark(fullForm, 1, toneType); // Acc.Pl уходит на корень: bȏby
                }
                const toneType = getAcuteToneType(fullForm, 0);
                return applyFourTonesMark(fullForm, 0, toneType);
            }
            return applyFourTonesMark(fullForm, 0, getAcuteToneType(fullForm, 0));
        }

        // --- В. СРЕДНИЙ РОД (Примеры: tě̂lo [долгий] vs ȏko [краткий]) ---
        if (isNeuter) {
            if (targetNumber === 'singular') {
                const toneType = getCircumflexToneType(fullForm, 1);
                return applyFourTonesMark(fullForm, 1, toneType); // tě̂lo (долгий ̂) vs ȏko (краткий ̑)
            }
            if (targetNumber === 'plural') {
                const toneType = getAcuteToneType(fullForm, 0);
                return applyFourTonesMark(fullForm, 0, toneType); // На окончание: telá
            }
            if (targetNumber === 'dual') {
                const toneType = getCircumflexToneType(fullForm, 1);
                return applyFourTonesMark(fullForm, 1, toneType); // Дуалис на корень: tě̂lě, ȏki
            }
        }
    }

    return fullForm;
}
