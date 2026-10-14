import { describe, expect, it } from "vitest"
import {
  HOMONYM_GROUP_SEPARATOR,
  homonymGroupKey,
  homonymGroupKeyForCandidates,
  parseHomonymGroupKey,
} from "@/lib/corpus/homonymGroup"
import { normalizeSurfaceForm } from "@/lib/corpus/surfaceForm"

describe("homonymGroupKey", () => {
  it("возвращает null, когда конкурирующей лексемы меньше двух", () => {
    // Неоднозначности по лексемам нет — спор о граммеме одной лексемы это
    // работа ранжирования, а не модератора (см. комментарий в модуле).
    expect(homonymGroupKey("ne", [])).toBeNull()
    expect(homonymGroupKey("ne", ["ne-PART"])).toBeNull()
    // Дубли одного слага не считаются за две лексемы.
    expect(homonymGroupKey("ne", ["ne-PART", "ne-PART"])).toBeNull()
    // Пустые слаги отбрасываются.
    expect(homonymGroupKey("ne", ["", "ne-PART"])).toBeNull()
  })

  it("строит ключ из нормализованной формы и набора слагов", () => {
    const key = homonymGroupKey("Ne", ["ne-PART", "na-ADP"])
    expect(key).toBe(`ne${HOMONYM_GROUP_SEPARATOR}na-ADP|ne-PART`)
    // Ключ всегда идёт через normalizeSurfaceForm формы.
    expect(key?.startsWith(normalizeSurfaceForm("Ne"))).toBe(true)
  })

  it("не зависит от порядка слагов — иначе одна группа распалась бы на две", () => {
    const a = homonymGroupKey("ne", ["ne-PART", "na-ADP"])
    const b = homonymGroupKey("ne", ["na-ADP", "ne-PART"])
    expect(a).toBe(b)
  })

  it("кириллическая форма группируется так же, как её латинская нормализация", () => {
    const cyr = homonymGroupKey("НЕ", ["ne-PART", "na-ADP"])
    const lat = homonymGroupKey(normalizeSurfaceForm("НЕ"), ["ne-PART", "na-ADP"])
    expect(cyr).toBe(lat)
  })

  it("слаги с запятыми и дефисами (составные лексемы) не ломают ключ", () => {
    const key = homonymGroupKey("je", ["imeti, imati-VERB", "je-PART"])
    const parsed = parseHomonymGroupKey(key!)
    expect(parsed?.wordSlugs).toEqual(["imeti, imati-VERB", "je-PART"])
  })
})

describe("homonymGroupKeyForCandidates", () => {
  it("собирает слаги из кандидатов, игнорируя их порядок и дубли", () => {
    const key = homonymGroupKeyForCandidates("na", [
      { wordSlug: "na-ADP" },
      { wordSlug: "na-ADP" },
      { wordSlug: "na-PART" },
    ])
    expect(key).toBe(`na${HOMONYM_GROUP_SEPARATOR}na-ADP|na-PART`)
    expect(homonymGroupKeyForCandidates("na", [{ wordSlug: "na-ADP" }])).toBeNull()
  })
})

describe("parseHomonymGroupKey", () => {
  it("разбирает ключ обратно в форму и отсортированные слаги", () => {
    const parsed = parseHomonymGroupKey(`ne${HOMONYM_GROUP_SEPARATOR}na-ADP|ne-PART`)
    expect(parsed).toEqual({ form: "ne", wordSlugs: ["na-ADP", "ne-PART"] })
  })

  it("возвращает null на мусоре", () => {
    expect(parseHomonymGroupKey("ne")).toBeNull()
    expect(parseHomonymGroupKey(`ne${HOMONYM_GROUP_SEPARATOR}`)).toBeNull()
    expect(parseHomonymGroupKey(`ne${HOMONYM_GROUP_SEPARATOR}ne-PART`)).toBeNull()
  })
})
