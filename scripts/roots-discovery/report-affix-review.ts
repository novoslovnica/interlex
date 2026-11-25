// Read-only pilot inventory. Surface markers retrieve candidates for editorial review.
import Database from "better-sqlite3"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { foldDiacritics } from "@/lib/corpus/tokenizer/foldDiacritics"
import { cyrillicToLatin } from "@/lib/orthography/standard"
import { remainingAffixes } from "./remaining-affixes"

interface Affix {
  type: 1 | 2
  value: string
  markers: readonly string[]
  pos?: string
  searchPos?: readonly string[]
  registryValues?: readonly string[]
  origin?: "slavic" | "borrowed"
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
  ru?: readonly string[]
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
  type?: Affix["type"]
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
      const key = pair.type === undefined
        ? `${pair.affix}:${pair.lexeme.id}`
        : `${pair.type}:${pair.affix}:${pair.lexeme.id}`
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
const remaining = inventory === "--remaining-affixes"
if (!path || (inventory !== undefined && inventory !== "--additional-prefixes" && !remaining) || process.argv.length > 4) {
  throw new Error("Usage: tsx scripts/roots-discovery/report-affix-review.ts <interlex.db> [--additional-prefixes | --remaining-affixes]")
}

const db = new Database(path, { readonly: true, fileMustExist: true })
function editorialDecision(affix: Affix, lexeme: Lexeme) {
  const review = reviewed.get(`${affix.type}:${affix.value}:${lexeme.id}`) ??
    reviewed.get(`${affix.value}:${lexeme.id}`)
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

    const coreForms = new Map<number, string[]>()
    if (remaining) {
      const translations = db.prepare<[], { lexemeId: number; value: string }>(`
        SELECT DISTINCT l.id AS lexemeId, t.value FROM translations t
        JOIN meanings m ON m.id = t.meaningId
        JOIN lexemes l ON l.id = m.lexemeId
        WHERE l.isPublic = 1 AND t.language = 'ru' AND t.value IS NOT NULL
        ORDER BY l.id, t.value
      `).all()
      const translationsByLexeme = new Map<number, string[]>()
      for (const { lexemeId, value } of translations) {
        const values = translationsByLexeme.get(lexemeId) ?? []
        values.push(value)
        translationsByLexeme.set(lexemeId, values)
      }
      for (const lexeme of publicLexemes) lexeme.ru = translationsByLexeme.get(lexeme.id) ?? []

      const rows = db.prepare<[], { lexemeId: number; value: string }>(`
        SELECT a.lexemeId, a.value FROM lexeme_allophones a
        JOIN allophone_flavors f ON f.id = a.flavorId
        JOIN lexemes l ON l.id = a.lexemeId
        WHERE l.isPublic = 1 AND f.code = 'CORE' AND a.type = 'standard'
        ORDER BY a.lexemeId, a.value
      `).all()
      for (const { lexemeId, value } of rows) {
        const group = coreForms.get(lexemeId) ?? []
        group.push(value)
        coreForms.set(lexemeId, group)
      }
    }
    const forms = (remaining ? publicLexemes : lexemes).map((lexeme) => {
      const spellings = remaining ? [lexeme.value, ...(coreForms.get(lexeme.id) ?? [])] : [lexeme.value]
      const normalized = (value: string | null) => remaining && lexeme.pos === "VERB"
        ? fold(value).replace(/ se$/u, "")
        : fold(value)
      return {
        lexeme,
        spellings: spellings.flatMap((spelling) => spelling ? [{ spelling, form: normalized(spelling) }] : []),
      }
    })
    const byForm = new Map<string, Lexeme[]>()
    for (const { lexeme, spellings } of forms) {
      for (const form of new Set(spellings.map(({ form }) => form))) {
        const group = byForm.get(form) ?? []
        group.push(lexeme)
        byForm.set(form, group)
      }
    }
    const families: readonly Affix[] = remaining ? remainingAffixes : inventory === "--additional-prefixes" ? additionalPrefixes : pilot
    const registryKey = (value: string | null) => (value ?? "").normalize("NFC").trim().toLowerCase()
    const baseParts = [nominalBase, adjectiveBase, verbalBase, { tails: [""], pos: ["ADV", "PRON", "NUM"] }]
    const basePositions = baseParts.flatMap(({ pos }) => pos)
    return families.map((affix) => {
      const names = new Set([fold(affix.value), ...affix.markers.map(fold)])
      const registryNames = new Set(affix.registryValues?.map(registryKey))
      const hasName = (value: string | null) => affix.registryValues
        ? registryNames.has(registryKey(value))
        : names.has(fold(value))
      const records = morphemes.filter((morpheme) => morpheme.type === affix.type && (
        hasName(morpheme.value) ||
        variants.some((variant) => variant.morphemeId === morpheme.id && hasName(variant.value))
      ))
      const ids = new Set(records.map(({ id }) => id))
      const candidates = forms.flatMap(({ lexeme, spellings }) => {
        if (affix.pos && lexeme.pos !== affix.pos) return []
        if (affix.searchPos?.length && (!lexeme.pos || !affix.searchPos.includes(lexeme.pos))) return []
        const matches = affix.markers.flatMap((marker) => {
          const segment = remaining ? fold(marker) : marker
          return spellings.filter(({ form }) => /^\p{L}+$/u.test(form) &&
            form.length > segment.length + (remaining ? 0 : 1) &&
            (affix.type === 1 ? form.startsWith(segment) : form.endsWith(segment)),
          ).map(({ form, spelling }) => ({ form, spelling, marker, segment }))
        })
        if (matches.length === 0) return []
        const currentMorphemes = byLexeme.get(lexeme.id) ?? []
        const possibleBases = new Map<number, Lexeme>()
        function collectBases(baseForm: string, allowedPos: readonly string[]) {
          for (const base of byForm.get(baseForm) ?? []) {
            if (base.id !== lexeme.id && base.pos && allowedPos.includes(base.pos)) {
              possibleBases.set(base.id, base)
            }
          }
        }
        for (const { form, segment } of matches) {
          if (affix.type === 1) {
            const remainder = form.slice(segment.length)
            if (remaining) collectBases(remainder, basePositions)
            else if (lexeme.pos) collectBases(remainder, [lexeme.pos])
            if (affix.value === "bez" && lexeme.pos === "ADJ" && remainder.endsWith("ny")) {
              for (const tail of nominalBase.tails) collectBases(remainder.slice(0, -2) + tail, nominalBase.pos)
            }
            continue
          }
          const remainder = form.slice(0, -segment.length)
          const stems = new Set([remainder])
          if (remaining || affix.value === "k" || affix.value === "nik" || affix.value === "n" || affix.value === "stv") {
            const reversePalatalization: Record<string, string> = { c: "k", z: "g", s: "h" }
            const previous = reversePalatalization[remainder.slice(-1)]
            if (previous) stems.add(remainder.slice(0, -1) + previous)
          }
          for (const { tails, pos } of remaining ? baseParts : suffixBases[affix.value] ?? []) {
            for (const stem of stems) {
              for (const tail of tails) collectBases(stem + tail, pos)
            }
          }
        }
        return [{
          ...lexeme,
          matchedMarkers: [...new Set(matches.map(({ marker }) => marker))],
          ...(remaining ? { matchedSpellings: [...new Set(matches.map(({ spelling }) => spelling))] } : {}),
          currentMorphemes,
          alreadyLinked: currentMorphemes.some(({ id }) => ids.has(id)),
          ...editorialDecision(affix, lexeme),
          possibleBases: [...possibleBases.values()],
        }]
      })
      const candidateIds = new Set(candidates.map(({ id }) => id))
      const linkedOutsideSearch = (remaining ? publicLexemes : lexemes).filter(({ id }) =>
        !candidateIds.has(id) && byLexeme.get(id)?.some((morpheme) => ids.has(morpheme.id))
      ).map((lexeme) => ({
        ...lexeme,
        currentMorphemes: byLexeme.get(lexeme.id) ?? [],
        ...editorialDecision(affix, lexeme),
      }))
      for (const { id } of linkedOutsideSearch) candidateIds.add(id)
      // A rejected or deferred pair remains visible after its old link is removed.
      const reviewedOutsideSearch = publicLexemes.flatMap((lexeme) => {
        if (candidateIds.has(lexeme.id)) return []
        const decision = editorialDecision(affix, lexeme)
        if (decision.editorialStatus === "pending") return []
        return [{ ...lexeme, currentMorphemes: byLexeme.get(lexeme.id) ?? [], ...decision }]
      })
      return {
        affix,
        records,
        ...(remaining ? {
          registryStatus: records.length === 0 ? "missing" :
            affix.value === "ba" && records.every(({ value }) => registryKey(value) === "b") ? "needs-review" : "registered",
        } : {}),
        sameSpellingRoots: morphemes.filter(({ type, value }) => type === 0 && hasName(value)),
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
