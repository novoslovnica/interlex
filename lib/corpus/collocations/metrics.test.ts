import { describe, it, expect } from "vitest";
import { diceCoefficient, pmi, logLikelihood, classifyByLogLikelihood, LL_CORE_THRESHOLD, LL_PERIPHERY_THRESHOLD } from "./metrics"

describe("logLikelihood", () => {
    it("matches the contingency-table reference for Manning & Schütze's (1999) 'new companies' example", () => {
        // c1=15828, c2=4675, c12=20, N=14307668, via the standard 2x2-contingency-table
        // G-test (Dunning 1993) — independently verified by hand (binomial
        // likelihood-ratio form) to be ~24.51, not the commonly misquoted 1291.42.
        const ll = logLikelihood({ f1: 15828, f2: 4675, f12: 20, n: 14307668 })
        expect(ll).toBeCloseTo(24.51, 2)
    })
})

describe("diceCoefficient", () => {
    it("is 1 when f1=f2=f12", () => {
        expect(diceCoefficient({ f1: 100, f2: 100, f12: 100, n: 1000 })).toBe(1)
    })

    it("is 0 when f12=0", () => {
        expect(diceCoefficient({ f1: 100, f2: 100, f12: 0, n: 1000 })).toBe(0)
    })
})

describe("pmi", () => {
    it("is null when f12=0", () => {
        expect(pmi({ f1: 10, f2: 10, f12: 0, n: 1000 })).toBeNull()
    })

    it("is 0 for an exactly-independent pair (f12 == f1*f2/n)", () => {
        const p = pmi({ f1: 100, f2: 100, f12: 10, n: 1000 })
        expect(p).toBeCloseTo(0, 9)
    })
})

describe("classifyByLogLikelihood", () => {
    it("classifies core at the core threshold", () => {
        expect(classifyByLogLikelihood(LL_CORE_THRESHOLD)).toBe("core")
    })

    it("classifies periphery just below the core threshold", () => {
        expect(classifyByLogLikelihood(LL_CORE_THRESHOLD - 0.01)).toBe("periphery")
    })

    it("classifies periphery at the floor", () => {
        expect(classifyByLogLikelihood(LL_PERIPHERY_THRESHOLD)).toBe("periphery")
    })

    it("classifies excluded (null) just below the floor", () => {
        expect(classifyByLogLikelihood(LL_PERIPHERY_THRESHOLD - 0.01)).toBeNull()
    })
})
