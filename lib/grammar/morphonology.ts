/**
 * Утилиты для праславянских и межславянских звуковых чередований
 */

// Карта первой палатализации (задненёбные -> шипящие перед гласными переднего ряда e, i, ь)
const FIRST_PALATALIZATION: Record<string, string> = {
    'k': 'č',
    'g': 'ž',
    'h': 'š',
    'ch': 'š',
};

// Карта йотовой палатализации (согласный + j)
const IOTATION: Record<string, string> = {
    't': 'č', // В межславянском праславянское *tj переходит в č или ć. Используем стандартную č
    'd': 'ž', // *dj -> ž / dž
    's': 'š',
    'z': 'ž',
    'k': 'č',
    'g': 'ž',
    'h': 'š',
    'ch': 'š',
    'c': 'č',
};

// Губные согласные, требующие вставки L-эпитетичного (epentheticum) перед j
const LABIALS = ['p', 'b', 'm', 'v', 'f'];

// Сонорные r/l/n перед j палатализуются (r'/l'/ń) без вставки эпентетического l,
// в отличие от губных. Подтверждено примерами живого словаря: "govoriti" -> govorjut,
// "galjati" -> galjajut, "obměniti" -> obměnjajut — то есть просто "+j", а не "+lj".
const SONORANTS_APPEND_J = ['r', 'l', 'n'];

/**
 * 1. Первая палатализация (First Palatalization)
 * Применяется в I классе (e-основы) для глаголов типа pekti -> pečeš, mogti -> možeš
 */
export function applyFirstPalatalization(stem: string): string {
    // Проверяем диграфы сначала (ch)
    if (stem.endsWith('ch')) {
        return stem.slice(0, -2) + 'š';
    }

    const lastChar = stem.slice(-1);
    if (lastChar in FIRST_PALATALIZATION) {
        return stem.slice(0, -1) + FIRST_PALATALIZATION[lastChar];
    }

    return stem;
}

/**
 * 2. Йотовая палатализация (Iotation / Йотация)
 * Применяется в IV классе (i-основы) для формы 1sg (настоящее время) и подтипах III класса
 */
export function applyIotation(stem: string): string {
    // 1. Проверяем сочетания согласных st -> šč, zd -> ždž
    if (stem.endsWith('st')) return stem.slice(0, -2) + 'šč';
    if (stem.endsWith('zd')) return stem.slice(0, -2) + 'ždž';
    if (stem.endsWith('sk')) return stem.slice(0, -2) + 'šč';
    if (stem.endsWith('zg')) return stem.slice(0, -2) + 'ždž';

    // 2. Проверяем губные согласные (Labials + j -> Labial + lj)
    const lastChar = stem.slice(-1);
    if (LABIALS.includes(lastChar)) {
        return stem + 'lj';
    }

    // 2b. Сонорные r/l/n + j -> просто +j, без вставки l
    if (SONORANTS_APPEND_J.includes(lastChar)) {
        return stem + 'j';
    }

    // 3. Стандартная йотация одиночных согласных
    if (lastChar in IOTATION) {
        return stem.slice(0, -1) + IOTATION[lastChar];
    }

    return stem;
}

