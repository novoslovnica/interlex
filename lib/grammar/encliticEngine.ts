import {stripAccents} from "@/lib/grammar/accentUtils";

export interface EncliticRequest {
    preposition: string;      // Предлог, например: "na", "za", "po", "okolo"
    accentedNounForm: string; // Уже сгенерированная форма существительного (например: "rǫ́kǫ", "bóbъ")
    paradigm: 'A' | 'B' | 'C';
    targetCase: 'nom' | 'acc' | 'gen' | 'dat' | 'ins' | 'loc';
    targetNumber: 'singular' | 'plural' | 'dual';
}

/**
 * Проставляет знак ударения на нужный слог предлога с НАЧАЛА строки
 * @param prep Строка предлога
 * @param syllableIndex Слог с начала (0 - первый слог, 1 - второй)
 */
function accentPreposition(prep: string, syllableIndex: number): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(prep.matchAll(vowels));

    if (matches.length === 0) return prep;

    const targetMatch = matches[syllableIndex] || matches[0];
    const targetIndex = targetMatch.index!;

    return prep.substring(0, targetIndex) + targetMatch[0] + '\u0301' + prep.substring(targetIndex + 1);
}

/**
 * Главный движок ретракции ударения на предлог по системе Зализняка
 */
export function applyPrepositionEnclitic(request: EncliticRequest): string {
    const { preposition, accentedNounForm, paradigm, targetCase, targetNumber } = request;

    const cleanPrep = preposition.toLowerCase().trim();
    // Очищаем форму существительного от старого ударения, если оно перенесется
    const cleanNoun = accentedNounForm.replace(/\u0301/g, '');

    // ПРАВИЛО 1: Ретракция происходит ТОЛЬКО в подвижной парадигме C
    if (paradigm !== 'C') {
        return `${preposition} ${accentedNounForm}`; // Парадигмы A и B игнорируют предлог (например: na rýbǫ, na ženǫ́)
    }

    // ПРАВИЛО 2: Ударение переносится только в тех падежах и числах,
    // где по закону Зализняка слово является энклиноменом (ударение изначально сидело на корне)

    let shouldRetract = false;

    // А. Женский род (основы на -ā и -i) в винительном падеже ед. числа (Acc.Sg)
    if (targetNumber === 'singular' && targetCase === 'acc') {
        shouldRetract = true; // *nà rǫkǫ, *zà dǫšǫ, *nà kostь
    }

    // Б. Мужской и средний род (o-основы, консонантные) в винительном падеже ед. числа (Acc.Sg)
    // а также в Именительном/Винительном падеже для неодушевленных/среднего рода
    if (targetNumber === 'singular' && (targetCase === 'acc' || targetCase === 'nom')) {
        shouldRetract = true; // *nà bóbъ, *nà nebo, *pò dolo
    }

    // В. Местный падеж (Loc.Sg) для некоторых i-основ и u-основ
    if (targetNumber === 'singular' && targetCase === 'loc') {
        shouldRetract = true; // *nà kosti, *pò synovju
    }

    // Г. Особое правило множественного числа: Винительный падеж мн. числа (Acc.Pl) мужского рода
    if (targetNumber === 'plural' && targetCase === 'acc') {
        shouldRetract = true; // *nà boby
    }

    // Выполняем перенос, если все условия совпали
    if (shouldRetract) {
        // Считаем количество слогов в предлоге для правильного ударения
        const prepVowelsCount = (cleanPrep.match(/[aeiouyěęǫọų]/gi) || []).length;

        let stressedPrep = '';
        if (prepVowelsCount === 1) {
            stressedPrep = accentPreposition(cleanPrep, 0); // Односложные предлоги: nà, zà, pò
        } else if (prepVowelsCount > 1) {
            stressedPrep = accentPreposition(cleanPrep, 0); // Двусложные предлоги: póred, ókolo (на первый слог)
        } else {
            stressedPrep = cleanPrep; // Предлоги без гласных (в, с, к) не могут нести ударение сами
        }

        return `${stressedPrep} ${cleanNoun}`;
    }

    // Если падеж не энклиноменальный (например Gen.Sg *ruký), ударение остается на окончании слова
    return `${preposition} ${accentedNounForm}`;
}

/**
 * Проставляет правильный краткий тон (гравис \u0300) на нужный слог предлога
 * @param prep Строка предлога (например, "na", "okolo")
 * @param syllableIndex Индекс слога с начала строки
 */
function accentPrepositionWithFourTones(prep: string, syllableIndex: number): string {
    const vowels = /[aeiouyěęǫọų]/gi;
    const matches = Array.from(prep.matchAll(vowels));

    if (matches.length === 0) return prep;

    const targetMatch = matches[syllableIndex] || matches[0];
    const targetIndex = targetMatch.index!;

    // На предлоги всегда падает краткое автоматическое ударение (гравис \u0300)
    return prep.substring(0, targetIndex) + prep[targetIndex] + '\u0300' + prep.substring(targetIndex + 1);
}

export interface EncliticFourTonesRequest {
    preposition: string;
    accentedNounForm: string; // Форма, сгенерированная функцией generateBaseNounFormWithFourTones
    paradigm: 'A' | 'B' | 'C';
    targetCase: string;
    targetNumber: string;
}

/**
 * 🔥 ОБНОВЛЕННЫЙ ДВИЖОК ЭНКЛИТИК ПОД ЧЕТЫРЕХТОНОВУЮ СИСТЕМУ
 */
export function applyPrepositionEncliticWithFourTones(request: EncliticFourTonesRequest): string {
    const { preposition, accentedNounForm, paradigm, targetCase, targetNumber } = request;
    const cleanPrep = preposition.toLowerCase().trim();

    // ПРАВИЛО 1: Ретракция невозможна, если предлог не имеет гласных (в, с, к)
    const prepVowelsCount = (cleanPrep.match(/[aeiouyěęǫọų]/gi) || []).length;
    if (prepVowelsCount === 0) {
        return `${preposition} ${accentedNounForm}`;
    }

    // ПРАВИЛО 2: Проверяем наличие нисходящих тонов (циркумфлексов) в слове.
    // \u0302 - долгий циркумфлекс, \u0311 - краткий циркумфлекс
    const hasCircumflex = /[\u0302\u0311]/.test(accentedNounForm);

    // Системный маркер Зализняка: перенос происходит только в парадигме C
    // и только тогда, когда слово в этой форме является безударным энклиноменом (несет циркумфлекс)
    let shouldRetract = paradigm === 'C' && hasCircumflex;

    // Дополнительная проверка по сетке падежей (перестраховка для исключений)
    if (shouldRetract) {
        const isAccusativeSg = targetNumber === 'singular' && targetCase === 'acc';
        const isNominativeSg = targetNumber === 'singular' && targetCase === 'nom';
        const isAccusativePl = targetNumber === 'plural' && targetCase === 'acc';
        const isLocativeSg = targetNumber === 'singular' && targetCase === 'loc';

        shouldRetract = isAccusativeSg || isNominativeSg || isAccusativePl || isLocativeSg;
    }

    if (shouldRetract) {
        // Очищаем существительное от старого ударения
        const cleanNoun = stripAccents(accentedNounForm);

        // Проставляем на предлог краткий восходящий тон (̀)
        const stressedPrep = accentPrepositionWithFourTones(cleanPrep, 0); // Всегда на 1-й слог предлога

        return `${stressedPrep} ${cleanNoun}`;
    }

    // Если условия не сошлись (например, восходящий акут в Gen.Sg ruký), оставляем всё как есть
    return `${preposition} ${accentedNounForm}`;
}
