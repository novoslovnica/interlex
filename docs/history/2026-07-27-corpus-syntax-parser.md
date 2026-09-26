# Corpus Syntax Parser (UD dependency graph) — 2026-07-27/28

> Вынесено из AGENTS.md при реструктуризации 2026-09-26.

Builds a Universal Dependencies–style dependency graph over already-tokenized corpus sentences — one edge per non-root token (`headTokenId=null` marks the clause root), stored in `CorpusDependency` (`corpus.db`). Deliberately a *separate* pass from POS-tagging/reanalysis: it reads existing `CorpusToken.lemma/pos/feats` and only builds edges, so it's much cheaper to re-run and doesn't retag anything.

**Schema** (`prisma/corpus.schema.prisma`, raw-SQL migration `scripts/db/2026-07-27-add-corpus-syntax-tables.ts` — same reason as always, no `_prisma_migrations` table in `corpus.db`):
- `CorpusDependency`: `sentenceId`, `headTokenId` (nullable, null only for root), `depTokenId` (`@unique` — a token has exactly one head, this is the tree-shape guarantee), `relation` (canonical UD deprel string), `confidence` (`'rule'|'heuristic'|'unresolved'` — same traffic-light naming convention as `DbAnalyzer`'s green/yellow/red), `source` (`'auto'|'manual'`).
- `VerbGovernment`: `verbLemma`, `reflexive`, `requiredCase`, `role` (`'obj'|'iobj'|'obl'`), `priority`. **Intentionally seeded empty** — same principle as the endings work: "a verb X governs case Y" is a linguistic fact that isn't fabricated by a script, only entered by a moderator (future admin) or a verified import. `getVerbGovernment()` (`lib/corpus/syntax/government.ts`) lazily loads it from `corpus.db` via `better-sqlite3` (guarded by a `typeof window` check, safe to import from client code) and falls back to an empty `VERB_GOVERNMENT_FALLBACK` map — so today every government-dependent code path (clause-role labeling, the homonym-disambiguation Pass C — see `2026-07-28-homonym-disambiguation.md`) degrades gracefully to a weaker heuristic rather than fabricating case facts. **The "future admin" arrived 2026-08-12**: `/admin/verb-government` (`Feature.VerbGovernmentEdit`) is a standard CRUD UI, modeled on `/admin/endings` — every write calls `resetVerbGovernmentCache()` so the running process picks up new facts without a restart. The table is still empty in practice (data entry is a moderator task, not done as part of building the UI) — Pass C and government-based clause-role labeling remain no-ops on production data until someone populates it.

**Build order, one deprel set per phase** (`lib/corpus/syntax/deprel.ts`'s `UD_DEPREL` is the *only* place deprel string literals should exist — everything else imports from it):
- Phase 2 (`parser.ts`/`npChunker.ts`/`prepPhrase.ts`/`clause.ts`): NP-internal (`amod`/`nmod`/`det`/`nummod`/`case`) and adposition attachment always run; clause-level roles (`root`/`nsubj`/`obj`/`iobj`/`obl`/`advmod`/`aux`/`cop`/`expl`/`discourse`/`punct`) only for `isSimpleClause` sentences (no `SCONJ`, see below).
- Phase 3 (`coordination.ts`): `cc`/`conj` — sentence-level predicate/argument coordination.
- Phase 4 (`complexSentence.ts`, `parseComplexSentence`): subordination — `mark`/`advcl`/`ccomp`/`acl`. **Not recursive**: all found subordinate clauses attach as siblings under the *main* clause's root, nested subordination (a clause inside a clause) isn't modeled — known MVP limitation.
- `dedupeByDepToken` (`parser.ts`) is a safety net: since `depTokenId` is unique and different rule modules assign edges independently, a token could in principle get two edges (already happened once during dev, see the `selectRoot` comment in `clause.ts`) — it keeps the first, logs a warning, rather than letting the `INSERT` throw.

**Two data-quality findings baked into the Phase 4 logic, not fixed upstream** (`complexSentence.ts` top-of-file comment has the full investigation):
- **`pos='SCONJ'` never occurs in the live corpus at all** — confirmed 0 of 0 tokens across 300 documents/10,594 sentences, and `interlex.db` has 0 lexemes tagged `SCONJ` (59 are `CCONJ`, including semantically-subordinating words like `dabi`/`da`/`kȯgda`/`jestli`). A literal `pos === SCONJ` check would never fire. Fixed *locally* in the parser with a curated `SUBORDINATOR_LEMMAS` lemma set (only unambiguous subordinators — `ako`/`li`/`koliko` deliberately excluded as context-dependent) rather than upstream in the dictionary, since re-tagging ~59 lexemes is a linguist-reviewed data change, not a parser bug fix (same "don't fabricate linguistic facts" principle as `VerbGovernment` above).
- Reflexive `sę`/`se` is matched by **surface form**, not lemma/POS — real data tags `sę` as `PRON` (lemma `se-PRON`) and the undiacriticized `se` isn't recognized by the analyzer at all (`pos=X`), so a POS/lemma check would silently miss it.
- Relative clauses (`acl`) are detected structurally (pronoun immediately after a comma, with a `VERB` before the next clause boundary), not from a relative-pronoun dictionary — `ktory`/`kto` etc. exist as *both* `ADJ` and `PRON` lexemes in `interlex.db` (the same homonymy pattern documented elsewhere for corpus tokens), so pattern-matching by POS alone would lose about half of real relative clauses.

**Manual editing**: `PUT /api/admin/corpus/syntax/edge/route.ts`, gated by `Feature.CorpusSyntaxEdit`, writes `source='manual'`. `saveDependencies` (`lib/corpus/syntax/persist.ts`) only ever deletes+recreates `source='auto'` rows on re-parse — manual edges survive re-running `POST .../parse-syntax`, same reimport-safety pattern as `semantic_relations`'s `ruwordnet_auto` scoping.

### Key Files
- `lib/corpus/syntax/index.ts` — barrel export, the only import path other modules should use
- `lib/corpus/syntax/deprel.ts` — `UD_DEPREL` canonical relation names
- `lib/corpus/syntax/government.ts` — `PREPOSITION_GOVERNMENT` (hardcoded, stable, populated) + `getVerbGovernment` (DB-backed, empty by design)
- `lib/corpus/syntax/clause.ts`, `complexSentence.ts`, `npChunker.ts`, `prepPhrase.ts`, `coordination.ts` — the parsing rules themselves, by phase
- `lib/corpus/syntax/persist.ts` — `saveDependencies`, the `source='auto'`-only reimport guard
- `app/api/admin/corpus/documents/[slug]/parse-syntax/route.ts` — runs the parser over an already-tokenized document
- `app/api/admin/corpus/syntax/edge/route.ts` — manual single-edge edit
- `app/admin/corpus/documents/[slug]/syntax/` — admin UI
- `scripts/db/2026-07-27-add-corpus-syntax-tables.ts` — idempotent raw-SQL migration
