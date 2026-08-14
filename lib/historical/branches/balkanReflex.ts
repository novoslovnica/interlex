// Регенерация балканославянских (болг./макед., дамаскины) рефлексов из
// Lexeme.proto (proto_bridge) или Lexeme.stem/value (phonetic_heuristic) — оба
// пути, как и у восточнослав. ветви (в отличие от старослав., которая только
// proto). См. итоговую таблицу правил в AGENTS.md "Historical Corpora".
//
// Метатеза плавных (правило №1) — БЕЗ изменений: ISV уже юж.-типа, как и
// болгарский, ra/la/rě/lě совпадают буквально.

const ACCENT_FOLD: Record<string, string> = { "å": "a", "é": "e" }
function foldAccents(s: string): string {
    let out = ""
    for (const ch of s) out += ACCENT_FOLD[ch] ?? ch
    return out
}

// Правило №2: йотация. tj/ć -> št, dj/đ/žd́ -> žd (как и старослав., см. ocsReflex.ts).
function applyDentalJotation(s: string): string {
    return s.replace(/tj/g, "št").replace(/dj/g, "žd").replace(/ć/g, "št").replace(/žd́/g, "žd").replace(/đ/g, "žd")
}

// Правило №3: ять — диалектная граница я/е, зависит от след. слога (см.
// AGENTS.md, средняя уверенность). Не пытаемся угадать условие — генерим ОБА
// варианта как отдельных кандидатов вместо одного решения.
function applyYatVariants(s: string): string[] {
    if (!s.includes("ě")) return [s]
    return [s.replace(/ě/g, "e"), s.replace(/ě/g, "ja")]
}

// Правило №4: еры — НЕ вокализуем, болгарское ъ часто сохраняется как есть
// (в отличие от вост.-слав., где ъ/ь->o/e). ȯ/ė (внутренний "тут был сильный
// ер" маркер ISV) сворачиваем к ъ/ь буквально, а не к o/e.
function applyJers(s: string): string {
    return s.replace(/ȯ/g, "ъ").replace(/ė/g, "ь")
}

// Правило №5: носовые. ę -> e, ǫ/ų -> ъ.
function applyNasals(s: string): string {
    return s.replace(/ę/g, "e").replace(/[ǫų]/g, "ъ")
}

// Правило №6: эпентетическое l — доп. кандидат.
function withEpentheticL(variants: string[]): string[] {
    const extra: string[] = []
    for (const v of variants) {
        const withL = v.replace(/([pbmvf])j/g, "$1lj")
        if (withL !== v) extra.push(withL)
    }
    return [...variants, ...extra]
}

// Правило №7: dl/tl -> l.
function applyDlTlSimplification(s: string): string {
    return s.replace(/[dt]l/g, "l")
}

export function applyBalkanReflex(input: string): string[] {
    if (!input) return []
    const base = foldAccents(input.toLowerCase().trim())

    let s = applyDentalJotation(base)
    s = applyJers(s)
    s = applyNasals(s)
    s = applyDlTlSimplification(s)

    const yatVariants = applyYatVariants(s)
    return Array.from(new Set(withEpentheticL(yatVariants)))
}
