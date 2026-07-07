// Строгое перечисление поддерживаемых языков из ТЗ
export type DictionaryLanguageCode =
// Славянские

    | 'ru' | 'be' | 'uk' | 'pl' | 'cs' | 'sk' | 'bg' | 'mk' | 'sr' | 'hr' | 'sl' | 'bs'
    // Неславянские

    | 'en' | 'de' | 'nl' | 'eo';

export interface DictionaryConfig {
    name: string;        // Человекочитаемое название словаря
    baseUrl: string;     // Базовый URL для административной панели / метаданных
    /**
     * Функция принимает исходное слово и возвращает полную валидную ссылку
     * на статью в толковом словаре.
     */
    getUrl: (word: string) => string;
}

// Реестр всех толковых словарей
export const DICTIONARY_REGISTRY: Record<DictionaryLanguageCode, DictionaryConfig> = {
    // --- РУССКИЙ (Толковый словарь Ожегова через Gufo.me) ---
    ru: {
        name: 'Толковый словарь Ожегова',
        baseUrl: 'https://gufo.me/dict/ozhegov/',
        getUrl: (word) => `https://gufo.me/dict/ozhegov/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- БЕЛОРУССКИЙ (Скарнік) ---
    be: {
        name: 'Verbum TSBM (Belarusian)',
        baseUrl: 'https://verbum.by/',
        getUrl: (word) => `https://verbum.by/?q=${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- УКРАИНСКИЙ (Горох / Академический СУМ-11) ---
    uk: {
        name: 'Тлумачний словник «Горох» (СУМ)',
        baseUrl: 'https://goroh.pp.ua',
        getUrl: (word) => `https://goroh.pp.ua/Тлумачення/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- ПОЛЬСКИЙ (Słownik Języka Polskiego PWN) ---
    pl: {
        name: 'Słownik Języka Polskiego (SJP)',
        baseUrl: 'https://sjp.pl',
        getUrl: (word) => `https://sjp.pl/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- ЧЕШСКИЙ (Lingea Nechybujte) ---
    cs: {
        name: 'Slovník současné češtiny (Lingea)',
        baseUrl: 'https://www.nechybujte.cz/',
        getUrl: (word) => `https://www.nechybujte.cz/slovnik-soucasne-cestiny/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- СЛОВАЦКИЙ (Slovníkový portál Jazykovedného ústavu Ľ. Štúra) ---
    sk: {
        name: 'Slovníkový portál JÚĽŠ',
        baseUrl: 'https://slovnik.juls.savba.sk',
        getUrl: (word) => `https://slovnik.juls.savba.sk/?w=${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- БОЛГАРСКИЙ (Речник на българския език) ---
    bg: {
        name: 'Толковен речник (Chitanka)',
        baseUrl: 'https://rechnik.chitanka.info/',
        getUrl: (word) => `https://rechnik.chitanka.info/w/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- МАКЕДОНСКИЙ (Дигитален речник на македонскиот јазик) ---
    mk: {
        name: 'Дигитален речник на македонскиот јазик',
        baseUrl: 'https://drmj.eu',
        getUrl: (word) => `https://drmj.eu/search?q=${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- СЕРБСКИЙ (Речник Матице српске / Вокабулар) ---
    sr: {
        name: 'Вокабулар сербског језика',
        baseUrl: 'https://vokabular.org',
        getUrl: (word) => `https://vokabular.org?search=${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- ХОРВАТСКИЙ (Hrvatski jezični portal) ---
    hr: {
        name: 'Institut za hrvatski jezik',
        baseUrl: 'https://rjecnik.hr/',
        getUrl: (word) => `https://rjecnik.hr/search.php?q=${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- СЛОВЕНСКИЙ (Fran - Slovarji Inštituta za slovenski jezik Frana Ramovša) ---
    sl: {
        name: 'Fran (Slovenski slovarji)',
        baseUrl: 'https://fran.si',
        getUrl: (word) => `https://fran.si/iskanje?Query=${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- БОСНИЙСКИЙ (Rječnik bosanskog jezika) ---
    bs: {
        name: 'Rječnik bosanskog jezika',
        baseUrl: 'https://rjecnik.ba',
        getUrl: (word) => `https://rjecnik.ba/search.php?uzorak=${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- АНГЛИЙСКИЙ (Oxford Learner\'s Dictionaries) ---
    en: {
        name: 'Oxford Learner\'s Dictionaries',
        baseUrl: 'https://oxfordlearnersdictionaries.com',
        getUrl: (word) => `https://oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- НЕМЕЦКИЙ (Duden) ---
    de: {
        name: 'Duden online',
        baseUrl: 'https://www.duden.de/',
        getUrl: (word) => `https://www.duden.de/suchen/dudenonline/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- ГОЛЛАНДСКИЙ / НИДЕРЛАНДСКИЙ (Van Dale) ---
    nl: {
        name: 'ANW IvdNT',
        baseUrl: 'https://anw.ivdnt.org',
        getUrl: (word) => `https://anw.ivdnt.org/article/${encodeURIComponent(word.trim().toLowerCase())}`,
    },

    // --- ЭСПЕРАНТО (Vortaro / Plena Ilustrita Vortaro de Esperanto) ---
    eo: {
        name: 'Plena Ilustrita Vortaro de Esperanto (PIV)',
        baseUrl: 'https://vortaro.net',
        getUrl: (word) => `https://vortaro.net#${encodeURIComponent(word.trim().toLowerCase())}`,
    },
};

