import { DictionaryLanguageCode, DICTIONARY_REGISTRY } from '@/lib/dictionary/dictionaries';

/**
 * Безопасно генерирует внешнюю ссылку на толковый словарь для любого языка
 * @param lang Код языка (например, 'ru', 'pl', 'eo')
 * @param word Слово для поиска статьи
 */
export function getExternalDictionaryUrl(lang: string, word: string): string | null {
    if (!word || !lang) return null;

    const targetLang = lang.toLowerCase() as DictionaryLanguageCode;
    const config = DICTIONARY_REGISTRY[targetLang];

    if (!config) {
        return null; // Язык отсутствует в конфигурации толковых словарей
    }

    return config.getUrl(word);
}
