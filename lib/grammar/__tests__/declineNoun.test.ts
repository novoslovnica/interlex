import { describe, it, expect } from "vitest";
import { declineNoun, IntegratedFormRequest } from '../declineNoun';
import { StemType } from '../endingsRegistry';

// The previous version of this file hardcoded per-form "expected" values
// that turned out to be stale Proto-Slavic reconstructions (jers ъ/ь, nasal
// ǫ) predating the 2026-07-24 modern-ISV endings fix (see AGENTS.md's
// "RESOLVED: Grammar Engine Was Producing Wrong Endings"). Asserting them as
// correct would certify that old bug as intended behavior, and this
// codebase deliberately never fabricates a "correct" linguistic form without
// DB/linguist confirmation (see the recurring "don't fabricate a linguistic
// fact" principle throughout AGENTS.md). Until each of these forms is
// re-verified by a linguist, this file only guards against *regressions* via
// snapshots - it does not assert that the current output is linguistically
// correct. Re-run with `--update` once a linguist has reviewed a diff.

const testWords = [
    {
        name: 'bog (masculine, o-hard, paradigm A)',
        word: 'bog',
        paradigm: 'A' as const,
        stemType: 'o_hard' as StemType,
        gender: 'masculine' as const,
    },
    {
        name: 'ruka (feminine, a-hard, paradigm B)',
        word: 'ruk',
        paradigm: 'B' as const,
        stemType: 'a_hard' as StemType,
        gender: 'feminine' as const,
    },
    {
        name: 'syn (masculine, u-basis, paradigm C)',
        word: 'syn',
        paradigm: 'C' as const,
        stemType: 'u_basis' as StemType,
        gender: 'masculine' as const,
    },
    {
        name: 'kost (i-basis, paradigm A)',
        word: 'kost',
        paradigm: 'A' as const,
        stemType: 'i_basis' as StemType,
        gender: 'feminine' as const,
    },
    {
        name: 'tělo (neuter, a-hard, paradigm C)',
        word: 'těl',
        paradigm: 'C' as const,
        stemType: 'a_hard' as StemType,
        gender: 'neuter' as const,
    },
];

describe('declineNoun', () => {
    for (const testData of testWords) {
        it(`generates a stable paradigm for ${testData.name}`, () => {
            const forms: Record<string, string> = {};
            for (const number of ['singular', 'plural', 'dual'] as const) {
                for (const caseName of ['nominative', 'accusative', 'genitive', 'dative', 'instrumental', 'locative', 'vocative'] as const) {
                    const request: IntegratedFormRequest = {
                        interslavicWord: testData.word,
                        paradigm: testData.paradigm,
                        stemType: testData.stemType,
                        targetCase: caseName,
                        targetNumber: number
                    };
                    forms[`${number}.${caseName}`] = declineNoun(request);
                }
            }
            expect(forms).toMatchSnapshot();
        });
    }
});
