export type SlavicLanguageCode = 'be' | 'bg' | 'bs' | 'cs' | 'hr' | 'mk' | 'pl' | 'ru' | 'sk' | 'sl' | 'sr' | 'uk';

export interface LanguageComprehension {
    code: SlavicLanguageCode;
    name: string; // Для локализации и тултипов
    isUnderstood: boolean;
    score?: number; // Задел на будущее для Semantic Similarity Weights
}

// Конфиг поддерживаемых языков (в будущем можно вынести в глобальный конфиг локализации)
export const SLAVIC_LANGUAGES_MAP: Record<SlavicLanguageCode, { nameRu: string; flag: string }> = {
    be: { nameRu: 'Белорусский', flag: '🇧🇾' },
    bg: { nameRu: 'Болгарский', flag: '🇧🇬' },
    bs: { nameRu: 'Боснийский', flag: '🇧🇦' },
    cs: { nameRu: 'Чешский', flag: '🇨🇿' },
    hr: { nameRu: 'Хорватский', flag: '🇭🇷' },
    mk: { nameRu: 'Македонский', flag: '🇲🇰' },
    pl: { nameRu: 'Польский', flag: '🇵🇱' },
    ru: { nameRu: 'Русский', flag: '🇷🇺' },
    sk: { nameRu: 'Словацкий', flag: '🇸🇰' },
    sl: { nameRu: 'Словенский', flag: '🇸🇮' },
    sr: { nameRu: 'Сербский', flag: '🇷🇸' },
    uk: { nameRu: 'Украинский', flag: '🇺🇦' },
};

/**
 * Парсит строку вида "be+ cs+ hr-" в массив объектов LanguageComprehension
 */
export function parseComprehensionString(rawString: string): LanguageComprehension[] {
    if (!rawString) return [];

    return rawString
        .trim()
        .split(/\s+/)
        .map((item) => {
            const code = item.slice(0, 2) as SlavicLanguageCode;
            const sign = item.slice(2);

            return {
                code,
                name: SLAVIC_LANGUAGES_MAP[code]?.nameRu || code.toUpperCase(),
                isUnderstood: sign === '+',
            };
        })
        .filter((item) => item.code in SLAVIC_LANGUAGES_MAP);
}
