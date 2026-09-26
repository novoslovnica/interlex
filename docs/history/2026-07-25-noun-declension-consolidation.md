# Noun Declension Had Two Parallel Engines, Now One — 2026-07-25/26/27 (RESOLVED)

> Вынесено из AGENTS.md при реструктуризации 2026-09-26.

Three consecutive commits (`declension fixes`, `accentology fix`, `canonical gender animacy`) each had to fix the *same* bug twice, in two different files, because noun declension existed as two independently-maintained implementations: **"Stack A"** (`lib/grammar/declineNoun.ts` + `lib/grammar/stemClassifier.ts` + `lib/grammar/fourTonesGenerator.ts`, used by the live word page) and **"Stack B"** (the old `lib/grammar/noun/index.ts`, used only by the corpus tokenizer's `processNoun()`).

**Bugs fixed in both stacks along the way:**
- `identifyStemTypeByDb()` compared `protoStemClass`/`stemExtension` against the TS enum's descriptive uppercase values (`ProtoStemClass.O_SHORT`), but the DB stores short lowercase Slavistic codes (`'o'`, `'jo'`, `'consonant'`...) — **the comparison never matched a single real word**, silently falling through to defaults every time. Fixed by lowercasing both sides before comparing.
- `Lexeme.animacy` was stored `'ANIM'` (uppercase) but the ending-override lookup (`ending_allophones`, keyed by UD grammeme strings like `'Animacy=Anim'`) expected `'Anim'` — **every animate-masculine noun's accusative singular silently fell back to the inanimate ending** (e.g. "vlk" instead of "vlka"). Fixed by canonicalizing `GrammaticalGender`/gender+animacy values to UD casing (`'Masc'/'Fem'/'Neut'`, `'Anim'/'Inan'`) project-wide, plus a one-time data migration (`scripts/db/2026-07-26-canonicalize-gender-animacy.ts`, idempotent, auto-backs-up to `interlex.db.backup-before-gender-animacy-canonicalization`) rewriting existing `lexemes.gender`/`animacy` values (including nulling out the non-UD `gender='verb'` on 804 verb rows).
- Two new noun classes added — `consonant_ent` (young-animal nouns, *telę*→stem *telent-*) and `consonant_er` (kinship terms, *mati*→stem *mater-*) — via a shared `stemWithExtension()` helper that inserts the historical stem augment between stem and ending outside nom./acc./voc. singular.
- Sonorants `r/l/n` before `j` were falling through to the wrong iotation rule (labial `+lj` or a generic table) instead of the correct `+j` (no epenthetic `l`) — added an explicit `SONORANTS_APPEND_J` branch in `lib/grammar/morphonology.ts`/`verb/index.ts::applyIotation`, verified against "govoriti"→"govorjut" etc.
- `processNoun()` (the corpus-engine path) was passing the full citation form as the declension root — for stem types where the citation form already contains the nominative ending (neuter o-stems like "selo"), this double-appended the ending ("seloo"). Fixed by passing `word.stem || word.isv`, matching the convention Stack A already used.

**Resolution**: `lib/grammar/noun/index.ts` (383 lines) was deleted outright once `processors.ts::processNoun` was switched to call `declineWordAutomatically` (Stack A) directly. **There is now exactly one noun declension engine** — any future noun-declension change only needs to touch `declineNoun.ts`/`stemClassifier.ts`/`fourTonesGenerator.ts`, not two places. (Standing rule, repeated in AGENTS.md: any new paradigm-showing surface goes through `lib/paradigm.ts`.)

**Also from this batch, an ongoing pattern worth knowing**: `lib/grammar/stress.ts::resolveStressOverride()` is now the single entry point for per-lexeme (`stressPosition`) and per-morpheme (stressed-suffix) accent overrides, threaded through *every* POS generator (noun, verb — including participles, which previously got no accent marks at all — adjective, pronoun, numeral cardinal/collective/ordinal, determiner). A new word class's generator needs to call this to respect stress overrides, or loanword accentuation will silently use hardcoded defaults. Also fixed in the same pass: verb paradigm-C present-tense retraction was using tone `'short'`/`'grave'` instead of `'neoacute'` (Dybo's law + Ivšić's law actually produce neo-acute — `lib/grammar/verb/index.ts::conjugateFullVerb`).

### Key Files
- `lib/grammar/declineNoun.ts`, `lib/grammar/stemClassifier.ts`, `lib/grammar/fourTonesGenerator.ts` — the single noun engine
- `lib/grammar/common/gender.ts` — canonical UD gender values
- `scripts/db/2026-07-26-canonicalize-gender-animacy.ts` — one-time data migration, idempotent
- `lib/grammar/stress.ts` — `resolveStressOverride`
- `lib/grammar/adjective/index.ts::classifyAdjectiveType` — also unified (was duplicated inline in both stacks)
