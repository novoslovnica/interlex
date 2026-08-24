// Часть словарных статей держит в одном поле несколько вариантов написания
// через запятую ("altana, altanka", "anglican, anglicanin" — 227 живых
// лексем), а часть несёт служебный префикс "#" ("#agentura" — 78 лексем).
// И то и другое попадает и в value, и в stem, поэтому у таких слов стем
// буквально равен "altana, altank": парадигма из него получается мусорная,
// а второй вариант недостижим вовсе — в корпусе такие слова не опознавались
// ни в одной форме.
//
// Здесь варианты только РАЗБИРАЮТСЯ, для индексации и сопоставления: сами
// строки в словаре не трогаются, расщепление статьи на две — редакторское
// решение, а не механическое. Токен корпуса не может содержать ни запятой,
// ни "#" (токенизатор режет по ним), поэтому работать с очищенными
// вариантами безопасно.

/** Разбирает поле словаря на отдельные варианты написания. */
export function expandVariants(raw: string | null | undefined): string[] {
    if (!raw) return []
    return raw
        .split(",")
        .map((part) => part.trim().replace(/^#+/, "").trim())
        .filter((part) => part.length > 0)
}

export interface LexemeVariant {
    value: string
    stem: string | null
}

/**
 * Пары «значение + стем» по вариантам. Варианты сопоставляются по позиции;
 * если стемов меньше, чем значений (или стем один на всех), берётся первый —
 * это лучше, чем не породить формы вообще. Если вариантов нет совсем
 * (пустое value), возвращает исходную пару как есть, чтобы вызывающий код
 * не терял лексему.
 */
export function lexemeVariants(value: string | null, stem: string | null): LexemeVariant[] {
    const values = expandVariants(value)
    const stems = expandVariants(stem)
    if (values.length === 0) return value ? [{ value, stem }] : []
    return values.map((v, i) => ({ value: v, stem: stems[i] ?? stems[0] ?? null }))
}
