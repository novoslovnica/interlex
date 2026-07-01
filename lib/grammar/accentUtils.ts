/**
 * Проставляет знак ударения (комбинируемый аккут) на нужный слог с конца слова
 */
export function applyAccent(word: string, syllableIndex: number): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));

    if (matches.length === 0) return word;

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    const char = word[targetIndex];
    const accentedChar = char + '\u0301'; // Unicode комбинируемое ударение

    return word.substring(0, targetIndex) + accentedChar + word.substring(targetIndex + 1);
}

export type AccentType = 'acute' | 'circumflex' | 'neoacute' | 'short';

/**
 * Проставляет знак ударения (аккуратный аккут или циркумфлекс) на нужный слог
 * @param syllableIndex Индекс слога с конца (0 - последний слог, 1 - предпоследний)
 * @param type Тип интонации ('acute' для A/B, 'circumflex' для C)
 */
export function applySpecificAccent(word: string, syllableIndex: number, type: AccentType): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(word.matchAll(vowels));

    if (matches.length === 0) return word;

    const targetMatchIndex = matches.length - 1 - syllableIndex;
    const targetIndex = matches[targetMatchIndex >= 0 ? targetMatchIndex : 0].index!;

    const char = word[targetIndex];

    // ВЫБОР ЗНАКА UNICODE:
    // \u0301 - Акут (́) — используется для старого и нового акута (длинные тона)
    // \u0302 - Циркумфлекс (̂) — классический праславянский нисходящий долгий тон
    // \u0300 - Гравис (̀) — используется для короткого ударения (краткие тона)
    let accentMark = '';
    switch (type) {
        case 'acute':
        case 'neoacute':
            accentMark = '\u0301';
            break;
        case 'circumflex':
            accentMark = '\u0302';
            break;
        case 'short':
            accentMark = '\u0300';
            break;
        default:
            accentMark = '\u0301';
    }

    const accentedChar = char + accentMark;

    return word.substring(0, targetIndex) + accentedChar + word.substring(targetIndex + 1);
}

/**
 * Полностью очищает строку от любых знаков славянских тонов
 * (acute \u0301, short_acute \u0300, circumflex \u0302, short_circumflex \u0311)
 */
export function stripAccents(word: string): string {
    return word.replace(/[\u0301\u0300\u0302\u0311]/g, '');
}


