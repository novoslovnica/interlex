// A plain/simplified Latin letter can, in casual writing, stand in for a
// canonical ISV letter that carries extra phonemic information the plain
// letter doesn't (e.g. "u" is a strict superset of the nasal "ų" - not the
// same sound, but "ų" is commonly simplified to "u" in casual spelling).
// The mapping only ever goes plain -> canonical, never the reverse: a
// canonical spelling is already the most specific representation and
// doesn't need widening.
//
// Confirmed with the maintainer (2026-08-12) for u -> ų only. Extend this
// table only for pairs confirmed the same way, not by guessing at the rest
// of the diacritic inventory - see AGENTS.md's recurring "don't fabricate a
// linguistic fact" principle (VerbGovernment, preposition links, etc. are
// all seeded empty for the same reason).
const SIMPLIFIED_TO_CANONICAL: Record<string, string[]> = {
    u: ['ų'],
};

/**
 * Expands a normalized surface form into every plausible "de-simplified"
 * variant, so a homonym-candidate search can also try the canonical
 * spelling(s) a plain letter might stand in for - not just the literal
 * input. Always returns the original form first. Cartesian product over
 * every expandable position in the word (in practice small: a handful of
 * occurrences at most, each with a small option count).
 */
export function expandSpellingVariants(form: string): string[] {
    const positions: string[][] = [];
    for (const ch of form) {
        const alternatives = SIMPLIFIED_TO_CANONICAL[ch];
        positions.push(alternatives ? [ch, ...alternatives] : [ch]);
    }

    let variants = [''];
    for (const options of positions) {
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
