import { describe, expect, it } from "vitest"
import {
  aggregateDuplicatePairs,
  assembleHomonymDuplicates,
  classifyDuplicatePair,
  isLegacyPosSlug,
  summarizeHomonymDuplicates,
  type DuplicateGroupResult,
  type LexemeMeta,
} from "@/lib/corpus/homonymDuplicates"
import { homonymGroupKey } from "@/lib/corpus/homonymGroup"

function lexeme(slug: string, value: string, pos: string, stem: string, extra: Partial<LexemeMeta> = {}): LexemeMeta {
  return { slug, value, pos, stem, gender: null, animacy: null, paradigm: null, corpusFrequencyPerMln: null, ...extra }
}

describe("isLegacyPosSlug", () => {
  it("узнаёт старый формат слага (POS строчными)", () => {
    expect(isLegacyPosSlug("drugy-adj")).toBe(true)
    expect(isLegacyPosSlug("pred-n")).toBe(true)
    expect(isLegacyPosSlug("drugy-ADJ")).toBe(false)
    expect(isLegacyPosSlug("imeti, imati-VERB")).toBe(false)
    expect(isLegacyPosSlug("слово")).toBe(false)
  })
})

describe("classifyDuplicatePair", () => {
  it("не считает дублем разные части речи — это настоящая омонимия", () => {
    expect(classifyDuplicatePair(lexeme("ne-ADV", "ne", "ADV", "ne"), lexeme("ne-INTJ", "ne", "INTJ", "ne"))).toBeNull()
  })

  it("помечает SAFE только буквальное совпадение value, основы, рода и POS", () => {
    const p = classifyDuplicatePair(
      lexeme("drugy-ADJ", "drugy", "ADJ", "drug"),
      lexeme("drugy-adj", "drugy", "ADJ", "drug"),
    )
    expect(p).not.toBeNull()
    expect(p!.kind).toBe("identical-value")
    expect(p!.safe).toBe(true)
    expect(p!.legacyPos).toBe(true)
    expect(p!.legacySlug).toBe("drugy-adj")
    expect(p!.otherSlug).toBe("drugy-ADJ")
  })

  it("НЕ помечает SAFE, когда буквально различаются основы (čel «лоб» vs cěl «целое»)", () => {
    const p = classifyDuplicatePair(
      lexeme("celo-NOUN", "celo", "NOUN", "čel", { gender: "Neut" }),
      lexeme("cělo-n", "celo", "NOUN", "cěl", { gender: "Neut" }),
    )
    expect(p).not.toBeNull()
    expect(p!.kind).toBe("identical-value")
    expect(p!.safe).toBe(false)
    expect(p!.stemEqRaw).toBe(false)
  })

  it("НЕ помечает SAFE при расхождении рода", () => {
    const p = classifyDuplicatePair(
      lexeme("x-NOUN", "x", "NOUN", "x", { gender: "Masc" }),
      lexeme("x-n", "x", "NOUN", "x", { gender: "Fem" }),
    )
    expect(p!.safe).toBe(false)
    expect(p!.genderMismatch).toBe(true)
  })

  it("подтверждённое правило i→y роднит РАЗНЫЕ глаголы — уровень confirmed-variant, не SAFE", () => {
    const p = classifyDuplicatePair(
      lexeme("biti-VERB", "biti", "VERB", "bi"),
      lexeme("byti-VERB", "byti", "VERB", "by"),
    )
    expect(p).not.toBeNull()
    expect(p!.kind).toBe("confirmed-variant")
    expect(p!.safe).toBe(false)
  })

  it("совпадение только после свёртки — уровень folded-only", () => {
    const p = classifyDuplicatePair(
      lexeme("žębra-n", "žębra", "NOUN", "žębr"),
      lexeme("zebra-NOUN", "zebra", "NOUN", "zebr"),
    )
    expect(p).not.toBeNull()
    expect(p!.kind).toBe("folded-only")
    expect(p!.safe).toBe(false)
  })
})

describe("assembleHomonymDuplicates + summarize", () => {
  const g = (form: string, slugs: string[], tokenCount: number, documentCount = 1) => ({
    groupKey: homonymGroupKey(form, slugs)!,
    tokenCount,
    documentCount,
  })

  it("собирает отчёт, агрегирует пары и считает итоги", () => {
    const lexemes = new Map<string, LexemeMeta>([
      ["drugy-ADJ", lexeme("drugy-ADJ", "drugy", "ADJ", "drug")],
      ["drugy-adj", lexeme("drugy-adj", "drugy", "ADJ", "drug")],
      ["drug-NOUN", lexeme("drug-NOUN", "drug", "NOUN", "drug")],
    ])
    const groups = [
      g("drugyh", ["drugy-ADJ", "drugy-adj"], 100),
      g("drugy", ["drugy-ADJ", "drugy-adj", "drug-NOUN"], 50),
    ]
    const result = assembleHomonymDuplicates(groups, lexemes)
    expect(result).toHaveLength(2)

    const totals = summarizeHomonymDuplicates(result)
    expect(totals.flaggedGroups).toBe(2)
    expect(totals.tokensInFlagged).toBe(150)
    // Пара drugy-ADJ/drugy-adj встречается в двух группах, но уникальная пара одна.
    expect(totals.distinctPairs).toBe(1)
    expect(totals.distinctSafePairs).toBe(1)
    expect(totals.pairsWithLegacy).toBe(2)

    const agg = aggregateDuplicatePairs(result)
    expect(agg).toHaveLength(1)
    expect(agg[0].groups).toBe(2)
    expect(agg[0].maxTokens).toBe(100)
    expect(agg[0].sumTokens).toBe(150)
  })

  it("пропускает группы без пар-дублей (настоящая омонимия)", () => {
    const lexemes = new Map<string, LexemeMeta>([
      ["ne-ADV", lexeme("ne-ADV", "ne", "ADV", "ne")],
      ["ne-INTJ", lexeme("ne-INTJ", "ne", "INTJ", "ne")],
    ])
    const result: DuplicateGroupResult[] = assembleHomonymDuplicates([g("ne", ["ne-ADV", "ne-INTJ"], 10)], lexemes)
    expect(result).toHaveLength(0)
  })
})
