// Регенерация восточнославянских (др.-рус./грамоты) рефлексов из ISV-формы
// (Lexeme.stem/value — уже южнослав.-типа, метатеза применена) или из
// Lexeme.proto (сырая праслав. реконструкция, если есть). Возвращает МНОЖЕСТВО
// кандидатов, а не одну строку — см. итоговую таблицу правил в AGENTS.md
// "Historical Corpora": по пп. 2б/4/6 у ISV несколько параллельных написаний,
// и матчер должен пробовать их все.
//
// Результат остаётся в той же "научной" латинской нотации, что и
// lib/historical/transliteration.ts (ě/ę/ǫ буквально, без перевода в
// орфографию совр. ISV) — сравнение идёт строка-в-строку с
// HistoricalToken.lemmaTranslit.

const VOWEL = "aeiouyěęǫų"
const isVowel = (ch: string) => VOWEL.includes(ch)

// В stem/value встречаются акцентные варианты гласных (å, é — знаки долготы/
// тона в системе четырёх тонов, см. lib/grammar/fourTonesGenerator.ts), не
// несущие фонологического различия, важного для звуковых законов. Сворачиваем
// их к базовой гласной до применения правил — тон нас тут не интересует.
const ACCENT_FOLD: Record<string, string> = { "å": "a", "é": "e" }
function foldAccents(s: string): string {
    let out = ""
    for (const ch of s) out += ACCENT_FOLD[ch] ?? ch
    return out
}

// Правило №1: полногласие/метатеза. ISV (юж.-тип, уже метатезировано) CraC/ClaC/CrěC/ClěC
// -> вост. CoroC/ColoC/CereC/CeleC. Не различаем строго a- и e- серии для L —
// см. оговорку в AGENTS.md, это приближение.
function applyPleophony(s: string): string {
    let out = ""
    for (let i = 0; i < s.length; i++) {
        const c1 = s[i]
        const liquid = s[i + 1]
        const vowel = s[i + 2]
        const c2 = s[i + 3]
        if (
            !isVowel(c1) && (liquid === "r" || liquid === "l") &&
            (vowel === "a" || vowel === "ě") && c2 !== undefined && !isVowel(c2)
        ) {
            const core = vowel === "a" ? (liquid === "r" ? "oro" : "olo") : (liquid === "r" ? "ere" : "ele")
            out += c1 + core
            i += 2 // c2 обрабатывается на следующей итерации
            continue
        }
        out += c1
    }
    return out
}

// Правило №2: йотация зубных. tj -> ć (единств.) уже применено в ISV как ć;
// dj -> đ (кратк.) или žd́ (долг.), оба реальны в ISV. Вост.: ć->č, đ->ž, žd́/žd->žd (без смягчения).
function applyDentalJotation(s: string): string {
    return s
        .replace(/ć/g, "č")
        .replace(/đ/g, "ž")
        .replace(/žd́/g, "žd")
}

// Правило №3: ять. ISV ě (отд. фонема) -> вост. e.
function applyYat(s: string): string {
    return s.replace(/ě/g, "e")
}

// Правило №4: еры. Конечный ъ/ь просто убираем (в вост.-слав. орфографии
// современных транслитераций конечных еров не пишут). Внутри слова ȯ/ė
// ("тут был сильный ер") вокализуются в o/e.
function applyJers(s: string): string {
    return s
        .replace(/ȯ/g, "o")
        .replace(/ė/g, "e")
        .replace(/[ъь]$/, "")
}

// Правило №5: носовые. ę -> a (упрощённо, без выделения смягчения предыд.
// согласного), ǫ/ų -> u.
function applyNasals(s: string): string {
    return s.replace(/ę/g, "a").replace(/[ǫų]/g, "u")
}

// Правило №6: эпентетическое l. И вост., и балканослав. вставляют l между
// губным (p/b/m/v/f) и j — генерируем ДОПОЛНИТЕЛЬНЫЙ кандидат, не заменяем.
function withEpentheticL(variants: string[]): string[] {
    const extra: string[] = []
    for (const v of variants) {
        const withL = v.replace(/([pbmvf])j/g, "$1lj")
        if (withL !== v) extra.push(withL)
    }
    return [...variants, ...extra]
}

// Правило №7: dl/tl -> l (упрощение, как в East/South).
function applyDlTlSimplification(s: string): string {
    return s.replace(/[dt]l/g, "l")
}

/**
 * Применяет все правила восточнослав. ветви к ISV-форме (stem/value) или к
 * Lexeme.proto, возвращая множество нормализованных кандидатов-рефлексов
 * (нижний регистр, без финальных еров) для fuzzy-сравнения с
 * HistoricalToken.lemmaTranslit.
 */
export function applyEastSlavicReflex(input: string): string[] {
    if (!input) return []
    const base = foldAccents(input.toLowerCase().trim())

    let s = applyPleophony(base)
    s = applyDentalJotation(s)
    s = applyYat(s)
    s = applyJers(s)
    s = applyNasals(s)
    s = applyDlTlSimplification(s)

    const variants = withEpentheticL([s])
    return Array.from(new Set(variants))
}
