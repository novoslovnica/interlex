// Association-strength metrics for corpus collocation extraction (see AGENTS.md
// "Ядро/периферия семантического поля"). f1/f2 are marginal token frequencies
// of the two words in the whole corpus, f12 is how often they co-occur within
// a token window, n is the total corpus token count.

export interface ContingencyCounts {
  f1: number
  f2: number
  f12: number
  n: number
}

export function diceCoefficient({ f1, f2, f12 }: ContingencyCounts): number {
  if (f1 + f2 === 0) return 0
  return (2 * f12) / (f1 + f2)
}

// Pointwise mutual information. Null when the pair never co-occurs (log2(0)
// is undefined) — PMI is unreliable at low frequency anyway, so callers
// should treat null as "not applicable" rather than a low score.
export function pmi({ f1, f2, f12, n }: ContingencyCounts): number | null {
  if (f12 <= 0 || f1 <= 0 || f2 <= 0 || n <= 0) return null
  return Math.log2((f12 * n) / (f1 * f2))
}

// Log-likelihood ratio (G², Dunning 1993) over the standard 2x2 contingency
// table: a=f12, b=f1-f12, c=f2-f12, d=n-f1-f2+f12. Robust to varying corpus
// size, unlike Dice/PMI — this is what classification is based on.
export function logLikelihood({ f1, f2, f12, n }: ContingencyCounts): number {
  const a = f12
  const b = f1 - f12
  const c = f2 - f12
  const d = n - f1 - f2 + f12

  const rowA = a + b
  const rowB = c + d
  const colA = a + c
  const colB = b + d
  if (n <= 0 || rowA <= 0 || rowB <= 0 || colA <= 0 || colB <= 0) return 0

  const expected = [
    (rowA * colA) / n,
    (rowA * colB) / n,
    (rowB * colA) / n,
    (rowB * colB) / n,
  ]
  const observed = [a, b, c, d]

  let g2 = 0
  for (let i = 0; i < 4; i++) {
    const o = observed[i]
    const e = expected[i]
    if (o <= 0 || e <= 0) continue // 0*ln(0/e) := 0 by convention
    g2 += o * Math.log(o / e)
  }
  return 2 * g2
}

export type CollocateClass = "core" | "periphery"

// Standard corpus-linguistics significance thresholds for log-likelihood.
export const LL_CORE_THRESHOLD = 15.13 // ≈ p < 0.0001
export const LL_PERIPHERY_THRESHOLD = 10.83 // ≈ p < 0.001

// Returns null for pairs below the significance floor — not a real
// collocate, just noise, and should be excluded from results entirely.
export function classifyByLogLikelihood(ll: number): CollocateClass | null {
  if (ll >= LL_CORE_THRESHOLD) return "core"
  if (ll >= LL_PERIPHERY_THRESHOLD) return "periphery"
  return null
}
