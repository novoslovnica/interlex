import { describe, it, expect } from "vitest"
import { buildVerbModel, conjugateFullVerb, VerbLexemeInput } from "./index"
import { processVerb } from "@/lib/grammar/morphology/processors"
import { stripCombiningAccents } from "@/lib/grammar/morphology/engine"
import { VerbalAspect, AccentParadigm } from "@/lib/grammar/common"

// Expected forms follow the corpus counts recorded in
// scripts/db/2026-09-15-modernize-participle-endings.ts.

function participles(head: string, extra: Partial<VerbLexemeInput> = {}) {
    const conj = conjugateFullVerb(buildVerbModel({ head, aspect: VerbalAspect.IPF, paradigm: AccentParadigm.A, ...extra }))
    const strip = (set: { masculine: string; feminine: string; neuter: string; plural: string }) => ({
        masculine: stripCombiningAccents(set.masculine),
        feminine: stripCombiningAccents(set.feminine),
        plural: stripCombiningAccents(set.plural),
    })
    return {
        presentActive: strip(conj.participles.presentActive),
        presentPassive: strip(conj.participles.presentPassive),
        pastPassive: strip(conj.participles.pastPassive),
    }
}

describe("present active participle", () => {
    it("uses -ęči without iotation for class IV", () => {
        expect(participles("govoriti").presentActive.masculine).toBe("govoręči")
        expect(participles("govoriti").presentActive.feminine).toBe("govoręča")
    })

    it("uses -ųči for thematic verbs", () => {
        expect(participles("znati").presentActive.masculine).toBe("znajųči")
        expect(participles("pisati", { secondaryStem: "piše" }).presentActive.masculine).toBe("pišųči")
    })
})

describe("present passive participle", () => {
    it("ends in -emy/-imy, not -emyj", () => {
        expect(participles("znati").presentPassive.masculine).toBe("znajemy")
        expect(participles("videti", { stem: "vidě", secondaryStem: "vidi" }).presentPassive.masculine).toBe("vidimy")
    })
})

describe("past passive participle", () => {
    it("ends in -ny/-eny/-ty with a masculine plural in -i", () => {
        expect(participles("napisati").pastPassive.masculine).toBe("napisany")
        expect(participles("napisati").pastPassive.plural).toBe("napisani")
        expect(participles("byti", { stem: "by" }).pastPassive.masculine).toBe("byty")
    })

    it("iotates class IV -iti, with plain j after labials", () => {
        expect(participles("stvoriti").pastPassive.masculine).toBe("stvorjeny")
        expect(participles("roditi").pastPassive.masculine).toBe("rodženy")
        expect(participles("upotrěbiti").pastPassive.masculine).toBe("upotrěbjeny")
    })

    it("keeps the ě of -ěti verbs (viděny)", () => {
        expect(participles("videti", { stem: "vidě", secondaryStem: "vidi" }).pastPassive.masculine).toBe("viděny")
    })
})

describe("processVerb", () => {
    const forms = (isv: string, extra: Record<string, string> = {}) =>
        new Set(processVerb({ id: 1, slug: "t", isv, pos: "VERB", ...extra }).map((f) => stripCombiningAccents(f.surfaceForm)))

    it("declines participles like adjectives and adds the short masculine", () => {
        const stvoriti = forms("stvoriti")
        expect(stvoriti.has("stvorjenyh")).toBe(true)
        expect(stvoriti.has("stvorjenoj")).toBe(true)
        expect(stvoriti.has("stvorjen")).toBe(true)
        expect(forms("govoriti").has("govoręčih")).toBe(true)
    })

    it("adds the past active participle in -vši for vowel stems", () => {
        expect(forms("sdělati").has("sdělavši")).toBe(true)
        expect(forms("byti", { stem: "by" }).has("byvši")).toBe(true)
    })
})
