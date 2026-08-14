// Регенерация старославянских рефлексов из Lexeme.proto ТОЛЬКО (proto-мост —
// единственный путь для этой ветви, без эвристики по stem/value, см. итоговую
// таблицу правил в AGENTS.md "Historical Corpora": старослав. уже юж.-типа,
// как и сам ISV, отдельная эвристика "ISV vs конкретный совр. язык" тут не
// нужна).
//
// В отличие от восточнослав. ветви, ять/еры/носовые почти не меняются —
// старослав. орфография и так пишет ě/ę/ǫ/ъ/ь буквально (та же нотация, что
// и в lib/historical/transliteration.ts), еры НЕ вокализуются и НЕ убираются
// (в отличие от совр. ISV, где конечных еров уже нет вовсе).
//
// Метатеза плавных внутри Lexeme.proto — наименее надёжное место здесь:
// значения proto в БД оказались не единообразны (см. живой пример "gъrdъ" —
// ер ПЕРЕД плавной, а не ПОСЛЕ, как в реальной старослав. орфографии типа
// "влъна"). Обрабатываем оба варианта (лит. or/ol/er/el и ъr/ьr/ъl/ьl), но
// это лучшее приближение, а не проверенное лингвистом правило — см. пометку
// в отчёте по этой ветви.

const VOWEL = "aeiouyěęǫų"
const isVowel = (ch: string) => VOWEL.includes(ch)
const ACCENT_FOLD: Record<string, string> = { "å": "a", "é": "e" }
function foldAccents(s: string): string {
    let out = ""
    for (const ch of s) out += ACCENT_FOLD[ch] ?? ch
    return out
}

// Правило №1: метатеза (юж.-тип, ISV уже такой же). Поверхностный вид or/ol/er/el
// -> ra/la/rě/lě. Плюс best-effort перестановка ер+плавная -> плавная+ер
// (см. предупреждение выше).
function applyMetathesis(s: string): string {
    let out = ""
    for (let i = 0; i < s.length; i++) {
        const c1 = s[i]
        const vowel = s[i + 1]
        const liquid = s[i + 2]
        const c2 = s[i + 3]
        if (!isVowel(c1) && (vowel === "o" || vowel === "e") && (liquid === "r" || liquid === "l") && c2 !== undefined && !isVowel(c2)) {
            const core = vowel === "o" ? (liquid === "r" ? "ra" : "la") : (liquid === "r" ? "rě" : "lě")
            out += c1 + core
            i += 2
            continue
        }
        out += c1
    }
    return out
        .replace(/ъr/g, "rъ").replace(/ьr/g, "rь")
        .replace(/ъl/g, "lъ").replace(/ьl/g, "lь")
}

// Правило №2: йотация зубных. Сырой proto может содержать нерезолвленные
// tj/dj (напр. "světj") или уже обработанные ć/đ/žd́ — распознаём оба вида,
// приводим к старослав. št/žd.
function applyDentalJotation(s: string): string {
    return s
        .replace(/tj/g, "št")
        .replace(/dj/g, "žd")
        .replace(/ć/g, "št")
        .replace(/žd́/g, "žd")
        .replace(/đ/g, "žd")
}

// Правило №6: эпентетическое l — южнослав. тоже вставляет (доп. кандидат).
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

export function applyOldChurchSlavonicReflex(input: string): string[] {
    if (!input) return []
    const base = foldAccents(input.toLowerCase().trim())

    let s = applyMetathesis(base)
    s = applyDentalJotation(s)
    s = applyDlTlSimplification(s)
    // Ять/еры/носовые сознательно НЕ трогаем — см. комментарий вверху файла.

    return Array.from(new Set(withEpentheticL([s])))
}
