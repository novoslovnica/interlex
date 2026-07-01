export function applyVerbAccent(
    stem: string,
    ending: string,
    paradigm: 'A' | 'B' | 'C',
    person: '1sg' | '2sg' | '3sg' | '1pl' | '2pl' | '3pl' | '1du' | '2du' | '3du'
): string {
    if (paradigm === 'A') {
        // Правило А: Ударение всегда на первый/главный слог корня
        return addToneToSyllable(stem, 1) + ending;
    }

    if (paradigm === 'B') {
        // Правило B: 1-е лицо ед.ч. на окончание, остальные — на последний слог корня
        if (person === '1sg') {
            return stem + addToneToSyllable(ending, 1);
        }
        return addToneToSyllable(stem, -1) + ending; // -1 означает последний слог основы
    }

    if (paradigm === 'C') {
        // Правило C: 1-е лицо на окончание, остальные — абсолютное начало слова (первый слог)
        if (person === '1sg') {
            return stem + addToneToSyllable(ending, 1);
        }
        // Внимание: если есть приставка (вы-, по-), в парадигме C ударение уйдет на неё!
        return addToneToSyllable(stem, 1) + ending;
    }

    return stem + ending;
}
