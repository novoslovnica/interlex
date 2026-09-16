// A plain/simplified Latin letter can, in casual writing, stand in for a
// canonical ISV letter that carries extra phonemic information the plain
// letter doesn't (e.g. "u" is a strict superset of the nasal "ų" - not the
// same sound, but "ų" is commonly simplified to "u" in casual spelling).
// The mapping only ever goes plain -> canonical, never the reverse: a
// canonical spelling is already the most specific representation and
// doesn't need widening. The plain spelling itself is always tried too, so
// nothing that matched literally before stops matching.
//
// Confirmed with the maintainer: u -> ų (2026-08-12) and i -> y after a
// consonant (2026-09-15, corpus: bil 551 next to byl 9 344, drugih 228 next to
// drugyh 2 037, vi 179 next to vy 3 548). Extend this table only for pairs
// confirmed the same way, not by guessing at the rest of the diacritic
// inventory - see AGENTS.md's recurring "don't fabricate a linguistic fact"
// principle (VerbGovernment, preposition links, etc. are all seeded empty for
// the same reason).
const SIMPLIFIED_TO_CANONICAL: Record<string, string[]> = {
    u: ['ų'],
    i: ['y'],
};

// Диграф: "dž" — обычная запись канонической "đ" (medža = međa). В корпусе
// через dž пишут на порядок чаще, чем через đ (18 228 токенов medžu- против
// 419 među-), а стем словаря хранит đ, поэтому без этой пары слово не
// находилось ни в одной форме. Свёрткой это не решается: đ упрощают и до
// голого d ("meduslovjansky" при стеме "međuslovjańsk"), так что свёртка
// обязана вести đ в d, иначе стем перестаёт совпадать со своим же value.
const DIGRAPH_TO_CANONICAL: Record<string, string> = {
    'dž': 'đ',
};

// y is only written after a consonant; after a vowel, j or at the start of a
// word an "i" is just an "i".
const NOT_BEFORE_Y = /[aeiouyěęǫųåėȯj]/;

// Every expandable letter doubles the variant count; a long word full of i/u
// would otherwise produce hundreds of spellings to look up. Positions past the
// cap keep only their literal letter.
const MAX_VARIANTS = 64;

function alternativesAt(form: string, index: number, ch: string): string[] | undefined {
    const alternatives = SIMPLIFIED_TO_CANONICAL[ch];
    if (!alternatives) return undefined;
    if (ch === 'i') {
        const prev = index > 0 ? form[index - 1] : '';
        if (!prev || !/\p{L}/u.test(prev) || NOT_BEFORE_Y.test(prev)) return undefined;
    }
    return alternatives;
}

/**
 * Expands a normalized surface form into every plausible "de-simplified"
 * variant, so a homonym-candidate search can also try the canonical
 * spelling(s) a plain letter might stand in for - not just the literal
 * input. Always returns the original form first. Cartesian product over
 * the expandable positions, capped at MAX_VARIANTS.
 */
function expandLetters(form: string): string[] {
    const chars = [...form];
    let variants = [''];
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const alternatives = alternativesAt(chars.join(''), i, ch);
        const options = alternatives && variants.length * (alternatives.length + 1) <= MAX_VARIANTS
            ? [ch, ...alternatives]
            : [ch];
        const next: string[] = [];
        for (const prefix of variants) {
            for (const option of options) {
                next.push(prefix + option);
            }
        }
        variants = next;
    }

    const rest = variants.filter((v) => v !== form);
    return [form, ...rest];
}

export function expandSpellingVariants(form: string): string[] {
    const bases = [form];
    for (const [digraph, canonical] of Object.entries(DIGRAPH_TO_CANONICAL)) {
        if (form.includes(digraph)) bases.push(form.split(digraph).join(canonical));
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const base of bases) {
        for (const variant of expandLetters(base)) {
            if (seen.has(variant) || out.length >= MAX_VARIANTS) continue;
            seen.add(variant);
            out.push(variant);
        }
    }
    return out;
}
