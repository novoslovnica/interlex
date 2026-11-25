// Read-only pilot inventory. Surface markers retrieve candidates for editorial review.
import Database from "better-sqlite3"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { cyrillicToLatin } from "@/lib/orthography/standard"

interface Affix {
  type: 1 | 2
  value: string
  markers: readonly string[]
  pos?: string
}

interface BasePattern {
  tails: readonly string[]
  pos: readonly string[]
}

// These transformations only retrieve dictionary forms to compare with the
// candidate. Lexical meaning and alternations still require editorial review.
const nominalBase = { tails: ["", "a", "o", "e", "j"], pos: ["NOUN"] }
const adjectiveBase = { tails: ["y", "i"], pos: ["ADJ"] }
const verbalBase = { tails: ["ti", "ati", "iti", "eti"], pos: ["VERB"] }
const suffixBases: Record<string, readonly BasePattern[]> = {
  ak: [nominalBase, adjectiveBase],
  ec: [nominalBase, adjectiveBase, verbalBase],
  k: [nominalBase],
  n: [nominalBase],
  nik: [nominalBase, adjectiveBase],
  ost: [adjectiveBase],
  stv: [nominalBase, adjectiveBase],
  telj: [verbalBase],
}

const pilot: readonly Affix[] = [
  { type: 1, value: "bez", markers: ["bez", "bes"] },
  { type: 1, value: "do", markers: ["do"], pos: "VERB" },
  { type: 1, value: "na", markers: ["na"], pos: "VERB" },
  { type: 1, value: "ne", markers: ["ne"], pos: "ADJ" },
  { type: 1, value: "pri", markers: ["pri"], pos: "VERB" },
  { type: 2, value: "ak", markers: ["ak"], pos: "NOUN" },
  { type: 2, value: "ec", markers: ["ec"], pos: "NOUN" },
  { type: 2, value: "k", markers: ["ka"], pos: "NOUN" },
  { type: 2, value: "n", markers: ["ny"], pos: "ADJ" },
  { type: 2, value: "nik", markers: ["nik"], pos: "NOUN" },
  { type: 2, value: "ost", markers: ["ost"], pos: "NOUN" },
  { type: 2, value: "stv", markers: ["stvo"], pos: "NOUN" },
  { type: 2, value: "telj", markers: ["telj", "tel"], pos: "NOUN" },
]

const additionalPrefixes: readonly Affix[] = [
  { type: 1, value: "iz", markers: ["iz", "is"], pos: "VERB" },
  { type: 1, value: "nad", markers: ["nad"], pos: "VERB" },
  { type: 1, value: "od", markers: ["od", "ot"], pos: "VERB" },
  { type: 1, value: "po", markers: ["po"], pos: "VERB" },
  { type: 1, value: "pod", markers: ["pod", "pot"], pos: "VERB" },
  { type: 1, value: "pre", markers: ["pre"], pos: "VERB" },
  { type: 1, value: "pro", markers: ["pro"], pos: "VERB" },
  { type: 1, value: "raz", markers: ["raz", "ras"], pos: "VERB" },
  { type: 1, value: "za", markers: ["za"], pos: "VERB" },
]

interface Lexeme {
  id: number
  slug: string
  value: string | null
  stem: string | null
  pos: string | null
  corpusFrequency: number | null
  isCollocation: number
}

interface Morpheme {
  id: number
  value: string | null
  type: number | null
  qualityFlag: string | null
  qualityFlagStatus: string | null
}

interface Variant {
  morphemeId: number
  code: string
  value: string
}

interface ReviewedPair {
  affix: string
  lexeme: { id: number; slug: string; value: string; pos: string; stem: string | null }
  reason?: string
  base?: { id: number; value: string }
}

type ReviewStatus = "confirmed" | "rejected" | "deferred"

const reviewDirectory = resolve("data/morpheme-review")
const reviewed = new Map<string, ReviewedPair & { status: ReviewStatus }>()
for (const file of readdirSync(reviewDirectory).filter((name) => name.endsWith(".json")).sort()) {
  const data = JSON.parse(readFileSync(resolve(reviewDirectory, file), "utf8")) as Partial<Record<ReviewStatus, ReviewedPair[]>>
  for (const status of ["confirmed", "rejected", "deferred"] as const) {
    for (const pair of data[status] ?? []) {
      const key = `${pair.affix}:${pair.lexeme.id}`
      const previous = reviewed.get(key)
      if (status === "deferred" && previous && previous.status !== "deferred") continue
      if (previous && previous.status !== "deferred" && previous.status !== status) throw new Error(`Conflicting editorial decisions for ${key}`)
      reviewed.set(key, { ...pair, status })
    }
  }
}

function fold(value: string | null): string {
  return foldDiacritics(cyrillicToLatin((value ?? "").trim().toLowerCase()))
}

const path = process.argv[2]
const inventory = process.argv[3]
if (!path || (inventory !== undefined && inventory !== "--additional-prefixes") || process.argv.length > 4) {
  throw new Error("Usage: tsx scripts/roots-discovery/report-affix-review.ts <interlex.db> [--additional-prefixes]")
}

const db = new Database(path, { readonly: true, fileMustExist: true })
function editorialDecision(affix: string, lexeme: Lexeme) {
  const review = reviewed.get(`${affix}:${lexeme.id}`)
  if (review && lexeme.slug === review.lexeme.slug && lexeme.value === review.lexeme.value &&
      lexeme.pos === review.lexeme.pos && lexeme.stem === review.lexeme.stem) {
    return { editorialStatus: review.status, editorialReason: review.reason, editorialBase: review.base }
  }
  return { editorialStatus: "pending" as const }
}

try {
  const report = db.transaction(() => {
    const publicLexemes = db.prepare<[], Lexeme>(`
      SELECT id, slug, value, stem, pos, corpusFrequency, isCollocation
      FROM lexemes
      WHERE isPublic = 1
      ORDER BY corpusFrequency DESC, id
    `).all()
    const lexemes = publicLexemes.filter(({ isCollocation }) => !isCollocation)
    const morphemes = db.prepare<[], Morpheme>(`
      SELECT id, value, type, qualityFlag, qualityFlagStatus
      FROM morphemes ORDER BY id
    `).all()
    const variants = db.prepare<[], Variant>(`
      SELECT a.morphemeId, f.code, a.value
      FROM morpheme_allophones a
      JOIN allophone_flavors f ON f.id = a.flavorId
      ORDER BY a.morphemeId, f.code
    `).all()
    const links = db.prepare<[], { lexemeId: number; morphemeId: number }>(`
      SELECT DISTINCT l.id AS lexemeId, m.id AS morphemeId
      FROM lexemes_morphemes lm
      JOIN lexemes l ON l.id = lm.lexemeId
      JOIN morphemes m ON m.id = lm.morphemeId
      WHERE l.isPublic = 1
      ORDER BY l.id, m.id
    `).all()

    const byLexeme = new Map<number, Morpheme[]>()
    const byId = new Map(morphemes.map((morpheme) => [morpheme.id, morpheme]))
    for (const link of links) {
      const morpheme = byId.get(link.morphemeId)
      if (!morpheme) continue
      const list = byLexeme.get(link.lexemeId) ?? []
      list.push(morpheme)
      byLexeme.set(link.lexemeId, list)
    }

    const forms = lexemes.map((lexeme) => ({ lexeme, form: fold(lexeme.value) }))
    const byForm = new Map<string, Lexeme[]>()
    for (const { lexeme, form } of forms) {
      const group = byForm.get(form) ?? []
      group.push(lexeme)
      byForm.set(form, group)
    }
    return (inventory === "--additional-prefixes" ? additionalPrefixes : pilot).map((affix) => {
      const names = new Set([fold(affix.value), ...affix.markers.map(fold)])
      const records = morphemes.filter((morpheme) => morpheme.type === affix.type && (
        names.has(fold(morpheme.value)) ||
        variants.some((variant) => variant.morphemeId === morpheme.id && names.has(fold(variant.value)))
      ))
      const ids = new Set(records.map(({ id }) => id))
      const candidates = forms.flatMap(({ lexeme, form }) => {
        if (affix.pos && lexeme.pos !== affix.pos) return []
        if (!/^\p{L}+$/u.test(form)) return []
        const matchedMarkers = affix.markers.filter((marker) => form.length > marker.length + 1 && (
          affix.type === 1 ? form.startsWith(marker) : form.endsWith(marker)
        ))
        if (matchedMarkers.length === 0) return []
        const currentMorphemes = byLexeme.get(lexeme.id) ?? []
        const possibleBases = new Map<number, Lexeme>()
        function collectBases(baseForm: string, allowedPos: readonly string[]) {
          for (const base of byForm.get(baseForm) ?? []) {
            if (base.id !== lexeme.id && base.pos && allowedPos.includes(base.pos)) {
              possibleBases.set(base.id, base)
            }
          }
        }
        for (const marker of matchedMarkers) {
          if (affix.type === 1) {
            const remainder = form.slice(marker.length)
            if (lexeme.pos) collectBases(remainder, [lexeme.pos])
            if (affix.value === "bez" && lexeme.pos === "ADJ" && remainder.endsWith("ny")) {
              for (const tail of nominalBase.tails) collectBases(remainder.slice(0, -2) + tail, nominalBase.pos)
            }
            continue
          }
          const remainder = form.slice(0, -marker.length)
          const stems = new Set([remainder])
          if (affix.value === "k" || affix.value === "nik" || affix.value === "n" || affix.value === "stv") {
            const reversePalatalization: Record<string, string> = { c: "k", z: "g", s: "h" }
            const previous = reversePalatalization[remainder.slice(-1)]
            if (previous) stems.add(remainder.slice(0, -1) + previous)
          }
          for (const { tails, pos } of suffixBases[affix.value] ?? []) {
            for (const stem of stems) {
              for (const tail of tails) collectBases(stem + tail, pos)
            }
          }
        }
        return [{
          ...lexeme,
          matchedMarkers,
          currentMorphemes,
          alreadyLinked: currentMorphemes.some(({ id }) => ids.has(id)),
          ...editorialDecision(affix.value, lexeme),
          possibleBases: [...possibleBases.values()],
        }]
      })
      const candidateIds = new Set(candidates.map(({ id }) => id))
      const linkedOutsideSearch = lexemes.filter(({ id }) =>
        !candidateIds.has(id) && byLexeme.get(id)?.some((morpheme) => ids.has(morpheme.id))
      ).map((lexeme) => ({
        ...lexeme,
        currentMorphemes: byLexeme.get(lexeme.id) ?? [],
        ...editorialDecision(affix.value, lexeme),
      }))
      for (const { id } of linkedOutsideSearch) candidateIds.add(id)
      // A rejected or deferred pair remains visible after its old link is removed.
      const reviewedOutsideSearch = publicLexemes.flatMap((lexeme) => {
        if (candidateIds.has(lexeme.id)) return []
        const decision = editorialDecision(affix.value, lexeme)
        if (decision.editorialStatus === "pending") return []
        return [{ ...lexeme, currentMorphemes: byLexeme.get(lexeme.id) ?? [], ...decision }]
      })
      return {
        affix,
        records,
        sameSpellingRoots: morphemes.filter(({ type, value }) => type === 0 && names.has(fold(value))),
        candidates,
        linkedOutsideSearch,
        reviewedOutsideSearch,
      }
    })
  })()
  console.log(JSON.stringify(report, null, 2))
} finally {
  db.close()
}
