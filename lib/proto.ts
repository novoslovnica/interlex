import { normalizeSoftConsonants, collapseDoubleJ } from './isv';

// Интерфейс расширенной записи в нашей базе данных
export interface EnhancedLemmaRow {
    interslavic: string;       // Междуславянская лемма
    protoSlavic: string;        // Праславянский прообраз
    paradigm: 'A' | 'B' | 'C';   // Акцентный тип Зализняка
    gender: 'masculine' | 'feminine' | 'neuter' | 'verb'; // Грамматический род/категория
    protoStemClass: string;     // Исторический класс основы (ā, jā, o, jo, i, u, consonant)
    stemExtension?: string;     // Наращение основы в падежах (en, es, et, er)
}

/**
 * Конвертирует праславянскую лемму в стандартную междуславянскую орфографию
 * @param protoWord Сырое праславянское слово из словаря Оландера
 * @returns Очищенное междуславянское слово
 */
export function convertToInterslavic_old(protoWord: string): string {
    // Приводим к нижнему регистру и очищаем от пробелов
    let word = protoWord.toLowerCase().trim();

    // 1. Убираем специфическую праславянскую диакритику долготы/тонов,
    // которую Оландер мог оставить на гласных (ā, ē, ō, ū, ī и знаки ударений)
    word = word
        .replace(/[āá]/g, 'a')
        .replace(/[ēé]/g, 'e')
        .replace(/[ōó]/g, 'o')
        .replace(/[ūú]/g, 'u')
        .replace(/[īí]/g, 'i')
        .replace(/[ь́ь̈]/g, 'ь')
        .replace(/[ъ́ъ̈]/g, 'ъ');

    // 2. Метатеза плавных (Закон открытого слога для сочетаний ORT / OLT в начале слова)
    // ort- / olt- перед согласными переходят в rat- / lat-
    if (/^[or]t/i.test(word)) { // Упрощенная проверка на согласный далее
        word = word.replace(/^or(?=[bcdfghjklmnprstvxzščž])/, 'ra');
        word = word.replace(/^ol(?=[bcdfghjklmnprstvxzščž])/, 'la');
    }

    // 3. Метатеза плавных внутри корня (Сочетания TORT, TOLT, TERT, TELT)
    // Переходят в междуславянские RAT, LAT, RĚT, LĚT (по южнославянскому типу)
    word = word.replace(/([bcdfghjklmnprstvxzščž])or([bcdfghjklmnprstvxzščž])/g, '$1ra$2');
    word = word.replace(/([bcdfghjklmnprstvxzščž])ol([bcdfghjklmnprstvxzščž])/g, '$1la$2');
    word = word.replace(/([bcdfghjklmnprstvxzščž])er([bcdfghjklmnprstvxzščž])/g, '$1rě$2');
    word = word.replace(/([bcdfghjklmnprstvxzščž])el([bcdfghjklmnprstvxzščž])/g, '$1lě$2');

    // 4. Трансформация носовых гласных (Юсов)
    // Большой юс (ǫ / ǭ) переходит в междуславянский ǫ (в расширенной орфографии) или 'u'
    // Малый юс (ę) переходит в междуславянский ę
    word = word.replace(/[ǫǭ]/g, 'ų'); // Используем стандартное расширенное ų (или 'u')
    word = word.replace(/ę/g, 'ę');    // Сохраняем малый юс как ę

    // 5. Обработка редуцированных (еръ 'ъ' и ерь 'ь')
    // На конце слова редуцированные ВСЕГДА падают (исчезают)
    word = word.replace(/[ъь]$/, '');

    // Внутри слова «сильные» редуцированные переходят в гласные:
    // Для междуславянского стандартом является переход в 'e' (ь) и 'o' (ъ), либо в 'e' для обоих
    // Применим базовое правило: ь -> e, ъ -> o (или убираем, если они были слабыми)
    word = word.replace(/ь/g, 'e');
    word = word.replace(/ъ/g, 'o');

    // 6. Специфические праславянские согласные звуки
    word = word.replace(/ʒ/g, 'z'); // Праславянский дз (ʒ) переходит в z

    // 7. Смягчение L и N (переход lь/nь перед согласными или на конце)
    word = word.replace(/ľ/g, 'lj');
    word = word.replace(/ń/g, 'nj');

    return word;
}

/**
 * Исправленный транслятор фонем: бережно очищает диакритику, сохраняя согласные
 */
export function convertToInterslavic(protoWord: string): string {
    let word = protoWord.toLowerCase().trim();

    // 1. Убираем абсолютно все надстрочные знаки (тоны, макроны долготы ¯) со ВСЕХ букв
    // \u0304 - макрон долготы, который часто ломал согласные n̄, r̄, t̄
    word = word.replace(/[\u0301\u0300\u0302\u0311\u0304\u0306\u030b\u0307]/g, '');

    // Нормализуем базовые гласные
    word = word
        .replace(/[āáǎ]/g, 'a')
        .replace(/[eéēěě́]/g, 'e')
        .replace(/[oóō]/g, 'o')
        .replace(/[uúū]/g, 'u')
        .replace(/[iíī]/g, 'i');

    // 2. Метатеза плавных в начале слова (ort-/olt- -> rat-/lat-)
    if (/^[or]t/i.test(word)) {
        word = word.replace(/^or(?=[bcdfghjklmnprstvxzščž])/, 'ra').replace(/^ol(?=[bcdfghjklmnprstvxzščž])/, 'la');
    }

    // 3. Метатеза плавных внутри корня (TORT -> RAT, TERT -> RĚT)
    word = word.replace(/([bcdfghjklmnprstvxzščž])or([bcdfghjklmnprstvxzščž])/g, '$1ra$2')
        .replace(/([bcdfghjklmnprstvxzščž])ol([bcdfghjklmnprstvxzščž])/g, '$1la$2')
        .replace(/([bcdfghjklmnprstvxzščž])er([bcdfghjklmnprstvxzščž])/g, '$1rě$2')
        .replace(/([bcdfghjklmnprstvxzščž])el([bcdfghjklmnprstvxzščž])/g, '$1lě$2');

    // 4. Носовые гласные (Юсы)
    word = word.replace(/[ǫǭ]/g, 'ų').replace(/ę/g, 'ę');

    // 5. Падение и вокализация редуцированных
    word = word.replace(/[ъь]$/, ''); // На конце строго удаляем
    word = word.replace(/ь/g, 'e');   // Внутри вокализуем
    word = word.replace(/ъ/g, 'o');

    // 6. Специфические согласные
    word = word.replace(/ʒ/g, 'z').replace(/[ľĺ]/g, 'lj').replace(/[ńń̄]/g, 'nj').replace(/ŕ/g, 'r');

    return word;
}

// Стреи кириллические омоглифы, оставшиеся от распознавания глифов Brill PDF
// (см. sanitizeProtoSlavic/brill_glyph_map.json — та функция разбирает
// токены /gXXXX, эта же чистит символы, которые уже "просочились" как
// обычная кириллица, например "оbčаръ" с кириллическими о/а вместо
// латинских). Намеренно НЕ включает ъ/ь — это настоящие кириллические
// еры, которые convertToInterslavic уже ожидает и обрабатывает.
const PROTO_HOMOGLYPHS: Record<string, string> = {
    'а': 'a', 'о': 'o', 'е': 'e', 'р': 'r', 'с': 'c', 'х': 'h',
    'у': 'u', 'в': 'v', 'н': 'n', 'к': 'k', 'м': 'm', 'т': 't',
};

function fixProtoHomoglyphs(s: string): string {
    return [...s].map((ch) => PROTO_HOMOGLYPHS[ch] ?? ch).join('');
}

// Порядок important: длинные окончания раньше коротких, иначе, например,
// "iti" срежется как "i" + "ti" вместо одного "iti".
const PROTO_ENDINGS = [
    'ěti', 'iti', 'ovati', 'nǫti', 'ati', 'ti', // маркеры инфинитива глагола
    'ьje', 'ьja', 'ije', 'ija', 'ьcь', 'ъkъ',   // частые деривационные хвосты после convertToInterslavic
    'ja', 'a', 'o', 'y', 'e',                     // голые гласные класса основы
];

function finalNormalizeForRootMatching(s: string): string {
    return collapseDoubleJ(normalizeSoftConsonants(s.toLowerCase().trim()));
}

/**
 * Приводит сырую лемму из proto_slavic_words (ESSJa) к форме, сравнимой с
 * современным корнем ISV (lib/grammar Morpheme.value): берёт первую
 * реконструкцию до "/" и первого пробела (отбрасывая "(sę)"/побочные формы/
 * римские цифры-омонимы), снимает ведущую "*", чинит кириллические
 * омоглифы, прогоняет через convertToInterslavic, снимает одно
 * праслав. окончание, и в конце применяет ту же нормализацию мягких
 * согласных (lib/isv.ts), что и корневая сторона сравнения — обе стороны
 * должны попасть в одну орфографию до подсчёта расстояния Левенштейна.
 */
export function normalizeProtoLemma(rawLemma: string): string {
    let token = (rawLemma || '').trim();
    token = token.split('/')[0];
    token = token.trim().split(/\s+/)[0] || '';
    token = token.replace(/^\*+/, '');
    token = token.replace(/[().,;:*]+$/g, '');
    token = fixProtoHomoglyphs(token);
    if (!token) return '';

    let converted = convertToInterslavic(token);
    for (const ending of PROTO_ENDINGS) {
        if (converted.endsWith(ending) && converted.length - ending.length >= 2) {
            converted = converted.slice(0, -ending.length);
            break;
        }
    }
    return finalNormalizeForRootMatching(converted);
}

/** Нормализует ISV-значение корня (Morpheme.value) той же финальной
 * орфографической нормализацией, что и normalizeProtoLemma, чтобы обе
 * стороны сравнения были сопоставимы. */
export function normalizeRootValueForMatching(value: string): string {
    return finalNormalizeForRootMatching(value || '');
}
import * as fs from 'fs';
import * as path from 'path';

// Карта глифов грузится лениво (только когда реально вызывается
// sanitizeProtoSlavic), а не на верхнем уровне модуля — раньше файл
// читался при импорте lib/proto.ts, из-за чего сам факт импорта этого
// модуля (например, для normalizeProtoLemma выше) падал с ENOENT, если
// brill_glyph_map.json не лежит в корне репозитория (он был перенесён в
// drafts/, путь ниже проверяет оба места).
let brillGlyphMapCache: Record<string, string> | null = null;

function loadBrillGlyphMap(): Record<string, string> {
    if (brillGlyphMapCache) return brillGlyphMapCache;
    const candidates = [
        path.resolve(process.cwd(), 'brill_glyph_map.json'),
        path.resolve(process.cwd(), 'drafts/brill_glyph_map.json'),
    ];
    const foundPath = candidates.find((p) => fs.existsSync(p));
    if (!foundPath) {
        throw new Error(`brill_glyph_map.json not found (checked: ${candidates.join(', ')})`);
    }
    brillGlyphMapCache = JSON.parse(fs.readFileSync(foundPath, 'utf-8'));
    return brillGlyphMapCache!;
}

/**
 * Динамический дешифратор на основе сгенерированной карты глифов
 */
export function sanitizeProtoSlavic(rawPdfWord: string): string {
    let word = rawPdfWord.toLowerCase().trim();

    // Ищем все токены /gXXXX в слове
    const matches = word.match(/\/g\d+/g);

    if (matches) {
        const brillGlyphMap = loadBrillGlyphMap();
        for (const token of matches) {
            // Берем дешифрованную букву из нашей карты (ъ, ь, ě и т.д.)
            const replacementChar = brillGlyphMap[token];

            // Заменяем токен на реальную славянскую букву.
            // Если глиф пустой (это был знак ударения) — он заменится на пустую строку "" и сотрется
            word = word.replace(token, replacementChar || '');
        }
    }

    // Очищаем мелкие остатки вёрстки и нормализуем согласные
    word = word
        .replace(/w/g, 'v')
        .replace(/[гвв‚б№†‰œўћўќіїєџћгâв‹ã¬]/g, '');

    return word;
}

