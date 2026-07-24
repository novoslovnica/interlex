// Manual check script (this repo has no vitest/jest runner — run via `npx tsx`).
import { diceCoefficient, pmi, logLikelihood, classifyByLogLikelihood, LL_CORE_THRESHOLD, LL_PERIPHERY_THRESHOLD } from "./metrics"

function approx(actual: number, expected: number, epsilon: number): boolean {
  return Math.abs(actual - expected) <= epsilon
}

let failures = 0
function check(name: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`PASS ${name}`)
  } else {
    failures++
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

// Manning & Schütze (1999) "new companies" example (c1=15828, c2=4675,
// c12=20, N=14307668) via the standard 2x2-contingency-table G-test
// (Dunning 1993) — independently verified by hand (binomial likelihood-ratio
// form) to be ~24.51, not the commonly misquoted 1291.42.
{
  const ll = logLikelihood({ f1: 15828, f2: 4675, f12: 20, n: 14307668 })
  check("logLikelihood matches contingency-table reference (~24.51)", approx(ll, 24.51, 0.01), `got ${ll}`)
}

// Trivial cases
{
  const dice = diceCoefficient({ f1: 100, f2: 100, f12: 100, n: 1000 })
  check("dice=1 when f1=f2=f12", dice === 1, `got ${dice}`)
}
{
  const dice = diceCoefficient({ f1: 100, f2: 100, f12: 0, n: 1000 })
  check("dice=0 when f12=0", dice === 0, `got ${dice}`)
}
{
  const p = pmi({ f1: 10, f2: 10, f12: 0, n: 1000 })
  check("pmi=null when f12=0", p === null, `got ${p}`)
}
{
  // independent pair: f12 == f1*f2/n exactly -> pmi = log2(1) = 0
  const p = pmi({ f1: 100, f2: 100, f12: 10, n: 1000 })
  check("pmi=0 for exactly-independent pair", approx(p ?? NaN, 0, 1e-9), `got ${p}`)
}

// Classification thresholds
check("classify core at threshold", classifyByLogLikelihood(LL_CORE_THRESHOLD) === "core")
check("classify periphery just below core threshold", classifyByLogLikelihood(LL_CORE_THRESHOLD - 0.01) === "periphery")
check("classify periphery at floor", classifyByLogLikelihood(LL_PERIPHERY_THRESHOLD) === "periphery")
check("classify excluded just below floor", classifyByLogLikelihood(LL_PERIPHERY_THRESHOLD - 0.01) === null)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log("\nAll checks passed")
}
