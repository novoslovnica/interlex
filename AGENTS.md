# Project Context: Interslavic Lexicon & Learning Platform (interlex)

## Project Overview
This project is an advanced digital ecosystem, dictionary, and linguistic corpus for the **Interslavic language** (Medžuslovjanski / Межславянский) hosted at `interslavic-lexicon.com`. It provides tools for searching, learning, translating, and dynamically managing a complex network of vocabulary, text collections, and linguistic relations.

### Core Features
- **Lexicon (Лексикон):** A searchable dictionary database for Interslavic words with full grammatical paradigms, morpheme analysis, script-aware display (Latin/Cyrillic/IPA), comprehension scoring across Slavic languages, synonyms, antonyms, etymology links, and cognate word family visualization.
- **Translator (Перевод):** Real-time translation tools between Interslavic and 16+ natural Slavic languages. Translations include active external links to authoritative explanatory dictionaries (толковые словари) of the respective target languages.
- **Library (Библиотека):** A curated collection of texts, parallel reading materials, and literature written in or translated into Interslavic.
- **Textbook (Учебник):** Structured educational modules and grammar lessons (e.g., `/textbook/ru`).
- **Proto-Slavic Dictionary (ESSJa):** Searchable etymological dictionary of Slavic languages (Этимологический словарь славянских языков) at `/proto` with word detail pages.
- **Corpus (Корпус):** KWIC (KeyWord In Context) search engine at `/corpus` with tokenized documents, POS tagging, and word-level annotations.
- **Transliteration (Транслитерация):** Tool for converting between Interslavic orthographic systems at `/transliteration`.
- **User Settings:** Script preference (Cyrillic/Latin), theme (Light/Dark/System), and language (isv/ru/en) at `/settings`.

### Admin Dashboard & Role-Based Access Control (`/admin`)
The platform includes a secure Admin Panel for lexical database management with a granular permission system:
- **Role-Based Access (RBAC):** Three roles — `USER` (read-only), `MODERATOR` (limited permissions), `ADMIN` (full access). Super-admins can define feature-specific permissions and capability flags for Moderators via `FeaturePermission` model.
- **Moderator Controls:** Moderators perform CRUD operations on lexemes, translations, and texts strictly based on their assigned permissions.
- **Admin Sections:** Translation table, Synonym management, Antonym management, Root management, Word candidate approval, Duplicate word merging (`/admin/deduplication`), User management & permissions (`/admin/users`), Word CRUD (`/admin/words`, `/admin/words/create`, `/admin/words/[id]/edit`).
- **Linguistic Relations:** Advanced interface to link lexemes together, building semantic and structural networks:
  - **Synonyms (Синонимы):** Grouping words with similar meanings.
  - **Antonyms (Антонимы):** Mapping polar opposite meanings.
  - **Cognates / Word Families (Однокоренные слова):** Clusterizing words sharing the same historical or morphological root, visualized via radar chart.

### Word Detail Pages (`/words/[id]`)
Each word detail page displays:
- Latin/Cyrillic display + IPA transcription
- Part of speech, gender, declension, conjugation, stem class metadata
- **Morpheme analysis** (root, prefix, suffix breakdown)
- **Comprehension widget** showing which Slavic languages understand the word
- **Full grammatical paradigm**: Verb conjugation (3 numbers, 6 tenses), noun/adjective/pronoun/numeral declension, adverb comparison
- **Meanings** with usage examples rendered via Markdown
- **Translations** into 16 languages with external dictionary links
- **Synonyms** and **Antonyms** rendered as interactive links
- **Cognate/word family** radar chart visualization
- **Etymology links** to Wiktionary and Proto-Slavic ESSJa pages

### Already Shipped (previously listed as roadmap — do not re-propose as new work)
- **Word Frequency (Частотность):** `Lexeme.corpusFrequency`, `corpusFrequencyPerMln`, `corpusRank`, `corpusHapax`, plus `distributionD` (Juilland's D) and `cefrLevel` (A1–C2) already exist on the `Lexeme` model (`prisma/data.schema.prisma`) and are computed by `scripts/compute-lexicon-frequency.ts` / `lib/corpus/frequencies/`. Recomputation is exposed via `POST /api/admin/recompute-frequencies`.

### Future Roadmap & Upcoming Features (Keep in Mind During Dev)
- **Data Visualization Graphs:** Engineering interactive UI elements such as **synonym clouds** and relational connection graphs to visually map semantic and structural word proximity.
- **Semantic & Structural Similarity:** Introduction of vector embeddings or algorithmic scoring to determine similarity weights between words.

---

## Tech Stack & Code Quality
- **Framework:** Next.js 16 (App Router architecture).
- **Language:** TypeScript 5 (strict mode). **Strict Rule:** Avoid `any` type completely. Use explicit interfaces or models (e.g., `Session | null` from `next-auth`).
- **Authentication & Security:** NextAuth.js v5 (beta). Telegram (Credentials provider with HMAC-SHA256, `crypto.timingSafeEqual` for constant-time comparison) + Yandex OAuth2 + Google OAuth2 providers (`auth.config.ts`). Protect all `/admin` routes, API endpoints, and Server Actions with session verification checking **the specific `Feature` permission flag for the action being performed** — checking session/role alone is not sufficient (`lib/permissions.ts`: `requireRole`/`requirePermission` for Server Components, `checkPermission` for API routes/Server Actions). There is no central `middleware.ts` — every route checks this by hand, so new routes must not skip it.
- **Database:** Four SQLite databases, each with its own Prisma client and schema file — `auth.db` (`prisma/auth.schema.prisma`: User, Session, FeaturePermission, UserSettings), `interlex.db` (`prisma/data.schema.prisma`: Lexeme, Meaning, Morpheme, relations, 18 language tables, ProtoSlavicWord), `library.db` (`prisma/library.schema.prisma`: LibraryEntry), and `corpus.db` (`prisma/corpus.schema.prisma`: CorpusDocument/Segment/Sentence/Token). Prisma 7 ORM; clients exported as `prismaAuth`/`prismaData`/`prismaLibrary`/`prismaCorpus` from `lib/prisma.ts`. Never cross database boundaries in a single query/transaction.
  - **⚠️ The actual `.db` files live at the project root** (`interlex.db`, `auth.db`, `library.db`, `corpus.db`), *not* inside `prisma/` — only the `*.schema.prisma` source files are under `prisma/`. Confirmed by `.env` (`DATA_DATABASE_URL="file:./interlex.db"`, etc.) and `.env.development`'s `SQLITE_DB`. Double-check `.env`/`.env.development` before writing any DB path in a script — don't assume `prisma/interlex.db` or similar.
- **Styling:** Tailwind CSS 4 with CSS custom properties for theming (`@theme inline`), dark/light/system theme support via `next-themes`.
- **Localization:** `next-intl` with cookie-based locale detection (isv/ru/en). Integrated `LanguageSwitcher` component.
- **Data Fetching:** `@tanstack/react-query` for client-side data fetching.
- **UI Components:** `@tanstack/react-table` (infinite editable tables), `@tanstack/react-virtual` (virtual scrolling), `recharts` (radar charts), `react-markdown` (meaning rendering).

---

## Layout & Architecture Rules

### 1. Unified Navigation (`HeaderNav`)
- **Desktop Layout:** Items must align in a single horizontal row (`flex-direction: row`, `white-space: nowrap`) to maintain a clean layout without vertical warping.
- **Mobile Layout (<768px):** Must collapse into a semantic hamburger menu controlled via React state (`isOpen`).
- **Overlay Behavior:** The mobile menu dropdown **must use absolute positioning** (`position: absolute; top: 100%`). It must float *over* the main layout and **never** push, shift, or distort the page content underneath.
- **Interaction:** All mobile menu links must automatically close the drawer overlay on click (`setIsOpen(false)`).

### 2. Lexical Database Updates & Integrity
- **Audit Logging:** Any write to `data.schema.prisma` models (Lexeme, Morpheme, translations, etc.) that changes a user-editable field must call `logAudit(user, entityType, entityId, changes)` from `lib/audit-log.ts` — see the dedicated "Audit Logging" section below. Do not resurrect the old per-table `actionHistory` JSON-blob pattern for new `data.schema.prisma` code.
- **Bidirectional Relations:** Relations (Synonyms, Antonyms, Cognates, and the 9 other relation tables) must maintain relational integrity — linking Word A as a synonym to Word B must reflect bidirectionally. **Fixed 2026-07-22** via `lib/relations.ts` (`fetchSymmetricRelations`/`saveSymmetricRelation`), which treats each table's `sourceId`/`targetId` as an unordered edge: reads match either column and writes diff-and-update the edge set instead of only ever touching `sourceId`. **Always use these two helpers for any new code that reads or writes the 11 relation tables** (synonyms, antonyms, hypernyms, hyponyms, meronyms, holonyms, related_words, causes, effects, premises, conclusions) — do not write a new one-off `WHERE sourceId = ?` query, that is exactly the pattern that caused the original bug.
- **Extensible Schema:** Keep data structures flexible to easily accommodate future frequency indexes, data arrays for etymology, dictionary URLs, and node/edge weights for visualization graphs.
- **Script-Aware Rendering:** All word displays must support Cyrillic/Latin toggling via ISV conversion functions.

### 3. Server/Client Component Architecture
- **Pages** are server components that fetch session data; interactive features use `"use client"` components.
- **Multi-Database Access:** Auth queries use the `prismaAuth` client; lexical queries use `prismaData`; library texts use `prismaLibrary`; corpus data uses `prismaCorpus`. Never cross database boundaries in a single query/transaction.

---

## AI Agent Development Principles
- **Prevent UI Regressions:** Always double-check that mobile dropdown/hamburger updates do not break desktop alignments, and vice-versa.
- **Maintain High Density:** Keep code scannable, structural styles semantic, and avoid redundant CSS overrides.
- **Grammar Engine Awareness:** The project includes a sophisticated grammar engine (`lib/grammar/`) handling verb conjugation, noun/adjective/pronoun/numeral declension, adverb comparison, stem classification, morphonology, accent/tone generation, and enclitic processing. Changes to word display or admin editing must respect these grammatical structures.

---

## Audit Logging (2026-07-25, `data.schema.prisma` only)

Replaced the old per-table `actionHistory` (a JSON-serialized array appended to a single `String?` column, duplicated across 21 models) with a shared `AuditLog` table — one row per changed field, grouped by a common `actionId`.

- **Scope**: `data.schema.prisma` only. `library.schema.prisma`'s `LibraryEntry.actionHistory` intentionally still uses the old `lib/action-history.ts` (`buildEntry`/`append`) pattern — do not delete that file or migrate library.db as part of unrelated work. `auth.db`/`corpus.db` have no audit table at all yet; if one is needed there, build an equivalent separate table rather than trying to share `AuditLog` across databases (the four Prisma clients never join across DBs).
- **How to log a change**: `await logAudit(session?.user, entityType, entityId, changes)` where `changes` is `{ field, oldValue, newValue }[]`. `logAudit` filters out no-op changes (old === new after serialization) and no-ops entirely if `changes` is empty after filtering — you can pass every candidate field unconditionally and let it filter. Non-string values are `JSON.stringify`'d automatically.
- **Synchronous/raw-SQL contexts**: `app/admin/deduplication/actions.ts` uses `better-sqlite3` inside a synchronous `db.transaction(() => {...})` callback, which can't `await` — it inlines an equivalent raw `INSERT INTO audit_logs` (same shape, same `randomUUID()` actionId, same serialize-and-filter logic) inside the transaction instead of calling `logAudit`. Follow that pattern for any other synchronous-transaction call site.
- **entityType convention**: string tags like `"Lexeme"`, `"Morpheme"`, `"Candidate"` — matched to the model actually mutated, not always the one visible in the URL (e.g. editing a translation logs under `"Lexeme"` with fields like `${lang}.value`/`${lang}.veryfied`/`${lang}.message`, since translations belong to a Lexeme).
- **Migrated write sites**: `lib/actions/word-actions.ts` (`ensureTranslation`/`syncTranslations`, now threaded with `wordId`), `app/api/lexicon/[id]/updateField/service.ts`, `app/api/roots/[id]/route.ts` and `app/api/roots/create/route.ts` (both previously had dead-code `actionHistory` destructured from the request body but never sent by the client — replaced with real before/after diffing), `app/admin/synonyms/page.tsx`, `app/admin/antonyms/page.tsx`, `app/admin/relations/[type]/page.tsx`, `app/admin/candidates/actions.ts`, `app/admin/deduplication/actions.ts`.
- **UI**: `/admin/platform/audit-log` (`app/admin/platform/audit-log/page.tsx`) — server component, GET-query-string filters (`entityType`/`entityId`/`userEmail`/`page`), paginated 50/page, gated by `requirePermission(session, Feature.LogsView)`. `Feature.LogsView` existed in `config/features.ts` since the original RBAC design but was unused anywhere until this page. Nav entry added in `app/admin/platform/_nav.tsx` ("Аудит") alongside "Библиотека"/"Пользователи".
- **Data migration note**: the pre-existing `actionHistory` data was intentionally **not** migrated into `AuditLog` and the column was dropped outright — active thesaurus editing hadn't started yet, so there was nothing worth preserving. If this is ever needed again for a different table, do not assume the same is true — check first.

### Key Files
- `lib/audit-log.ts` — `logAudit()` helper, `FieldChange` type
- `prisma/data.schema.prisma` — `AuditLog` model (`@@map("audit_logs")`)
- `scripts/db/2026-07-25-add-audit-log.ts` — deployment script (creates `audit_logs` table + indexes, drops `actionHistory` column from the 21 tables that had it) — idempotent, safe to re-run
- `app/admin/platform/audit-log/page.tsx` — read UI
- `lib/action-history.ts` — **still used**, but only by `library.schema.prisma` call sites (`app/admin/platform/library/new/page.tsx`, `app/admin/platform/library/[id]/edit/page.tsx`) — do not delete

---

## Semantic Network (Synset / relation tables) — architecture notes (2026-07-22, discussion only, no code changed)

The maintainer manually walked RuWordNet, pulled synsets for Russian translations of Interslavic words, and linked them — but ~48% of `meanings` still have no synset link, `Synset.synsetId` is literally RuWordNet's own native ID (no interlex namespace), and it wasn't clear whether the semantic network should live in its own database. This section is a consultation writeup, not an implemented change — nothing below has been built yet.

**Current shape** (confirmed by reading the code, not assumed):
- The 11 relation tables (`Synonym`, `Antonym`, `Hypernym`, `Hyponym`, `Meronym`, `Holonym`, `RelatedWord`, `Cause`, `Effect`, `Premise`, `Conclusion`) — all `{id, sourceId→Meaning, targetId→Meaning, proximity}` — **are already Interslavic's own semantic graph** over `Meaning`, fully independent of RuWordNet's own graph shape. `lib/relations.ts` (`fetchSymmetricRelations`/`saveSymmetricRelation`) and the admin UI (`app/admin/relations/[type]/page.tsx`, `app/admin/synonyms/page.tsx`, `app/admin/antonyms/page.tsx`) already let a moderator hand-link any two meanings today, with **zero dependency on synsets**.
- `Synset`/`MeaningSynset` are better understood as a **provenance/staging layer** recording "this meaning was matched to this external RuWordNet/WordNet concept," not the network itself. There is currently no UI at all for Synset/MeaningSynset (browse/edit/manual-create) — only one-off populate scripts (`scripts/db/upload-synsets.ts`, `upload-synset-relations.ts`, `upload-synonyms-antonyms.ts`), fed by `scripts/python/process_words.py` matching Russian glosses to RuWordNet **by exact string match** (the source of the 48% gap — no fuzzy matching exists yet, though `lib/levenshtein.ts` — already used by `CognateRadarChart.tsx` — could be reused for a future fuzzy-candidate tool).

**Real risk found during this investigation, not yet fixed**: `scripts/db/upload-synset-relations.ts` does `DELETE FROM <table>` across all 9 non-synonym/antonym relation tables on every run, then reinserts from the RuWordNet JSON. The moment a moderator starts hand-editing relations through the admin UI, re-running this script will silently wipe those edits — there is no `source` column on any of the 11 relation tables to scope the delete. Fix (not yet done): add a `source` column (`'manual'` vs `'ruwordnet_auto'`) to the 11 tables, tag inserts in `lib/relations.ts`'s `saveSymmetricRelation` as `'manual'`, and change the reimport script's delete to `WHERE source = 'ruwordnet_auto' OR source IS NULL`. Do this **before** active thesaurus editing ramps up on this data (same reasoning as the [[Audit Logging]] work above).

**Single DB vs. separate `semantics.db` — discussed, not decided**:
- **Argument for staying in `data.schema.prisma`** (current lean, not finalized): every real call site (`lib/relations.ts`, the relation admin pages, `app/words/[id]/SynonymGraph.tsx`) joins relation edges directly against `meanings`/`lexemes` text in one query today. The project already has a hard rule against cross-database queries (auth.db/interlex.db/library.db/corpus.db never joined in one query/transaction) — splitting out semantics would force every one of those call sites into a two-phase fetch (edge IDs from one DB, then a batched lookup of word/meaning text from another), and would lose the `onDelete: Cascade` FK guarantee from `Meaning` to the 11 relation tables, requiring hand-written cleanup code on every Meaning/Lexeme delete — precisely the class of bug (orphaned rows, referential drift) already fixed for these same tables via [[Bidirectional Relations]] earlier this project. Current volume (~30k relation rows, 12.6k synsets) is nowhere near needing physical separation for scale.
- **If a separate `semantics.db` were built anyway**, the discussed shape was 4–5 tables instead of today's 13 (11 relation tables + Synset + MeaningSynset):
  1. `SemanticRelation` — the 11 tables collapsed into one, with a `relationType` enum column (`synonym|antonym|hypernym|hyponym|meronym|holonym|related|cause|effect|premise|conclusion`) plus `sourceMeaningId`/`targetMeaningId` (bare ints, no real cross-DB FK), `proximity`, `source`.
  2. `ExternalConcept` — `Synset` renamed and decoupled from a single source: `sourceSystem` (`'ruwordnet'|'wordnet_en'|...`), `externalId` (native ID within that source), `ili` (Open Multilingual Wordnet bridge code — already present today as `synsetExternalId`, populated for ~67% of synsets), `definition`/`domains`/`partOfSpeech`. Unique on `(sourceSystem, externalId)` instead of a bare string PK, so a second imported wordnet can't collide with RuWordNet's own ID space.
  3. `MeaningExternalConcept` — bridge table (`meaningId`, `externalConceptId`, `confidence`, `matchMethod: 'exact_string'|'fuzzy'|'manual'`).
  4. (Optional) `ExternalConceptRelation` — the *source's own* synset↔synset graph, kept separate from `SemanticRelation`, so a future improved matcher could re-derive Interslavic relation edges from it without re-running the whole Python pipeline.
  - Connecting to further external semantic bases (a Polish/Ukrainian wordnet, Princeton WordNet directly) would go through the same `ili` bridge column — `ExternalConcept` rows sharing a non-null `ili` across different `sourceSystem` values represent the same universal concept, and could later be clustered.
  - This was **not adopted** — the two-phase-fetch/lost-cascade cost above applies here too, no matter how clean the table shape is, and the maintainer has not decided to pay that cost yet.

**The 11-table duplication and the separate-DB question are two independent decisions, not one.** The maintainer pointed out that this same writeup elsewhere calls 11 near-identical relation tables a schema smell — true, confirmed by reading `prisma/data.schema.prisma` lines 282–436: `Synonym`...`Conclusion` are byte-for-byte identical (`id, sourceId→Meaning, targetId→Meaning, proximity`), differing only in model/table name and the named-relation string (`"HypernymSource"` etc.). But that duplication is fixed by consolidating into one `SemanticRelation` table with a `relationType` column **in place, inside `interlex.db`** — it does not require a separate database:
- `lib/relations.ts` is already parametrized by table name as a string; consolidating just adds a `WHERE relationType = ?` filter alongside the existing table-name parametrization, not a rewrite.
- `app/admin/relations/relation-config.ts` already keeps per-type UI config (color/label/`featureKey`) separate from `tableName` — that part doesn't change at all; only the `tableName` field across the 9 configs converges on one value plus a `relationType`.
- The `Meaning → relation` FK cascade stays intact — still one database, just one table instead of eleven.
- Future schema changes (e.g. the `source` column fix above) become one `ALTER TABLE` instead of eleven.
- Moving to a separate DB buys nothing extra for the consolidation itself — `lib/relations.ts`/the admin pages/`relation-config.ts` need the same rewrite regardless of whether the resulting single table lives in `interlex.db` or a hypothetical `semantics.db`. The DB split adds its two-phase-fetch/lost-cascade cost **on top of**, not instead of, the duplication fix.
- **Conclusion**: if the goal is killing the 11-table duplication, consolidate in place — that decision doesn't depend on and shouldn't wait for the separate-DB question. The separate-DB question, if it's ever revisited, needs its own justification (lifecycle isolation, regenerability, growth of external sources), not table count.

**Status (2026-07-23): moved from discussion to implementation.** The maintainer approved a concrete build-out, locking in the following decisions (superseding the "not decided" framing above for these specific points — the single-DB-vs-separate-DB question itself is still not reopened, still resolved as "stay in `data.schema.prisma`"):

- **`SemanticRelation` replaces the 11 tables, one row per fact, direction via source/target — not one row per direction.** Today's `hypernyms`/`hyponyms` (and `meronyms`/`holonyms`, `causes`/`effects`, `premises`/`conclusions`) are two **independently generated** row sets — confirmed by reading `scripts/python/process_words.py`: `get_related_words(synset.hypernyms, ...)` and `get_related_words(synset.hyponyms, ...)` are separate lookups per word, not derived from each other, so the two tables can already disagree/be incomplete relative to each other. The new model stores the fact once: symmetric types (`synonym`, `antonym`, `related`, `pos_synonym`) are order-independent (normalize `sourceId = min`, `targetId = max` on write so the unique index dedupes correctly); directional types (`hypernymy`, `meronymy`, `causation`, `entailment`, `instance_of`, `derivation`) fix source=specific/dependent-side, target=general/governing-side by convention.
- **New relation types added, not deferred**: `pos_synonym` (symmetric, from RuWordNet's `pos_synonymy_relation` — cross-POS synonymy, e.g. a noun and verb sharing a root meaning), `instance_of` (directional, from `instance_relation` — "Moscow" instance-of "city", distinct from is-a/hypernymy), `derivation` (directional, from `derivation_relation` — morphological derivation between senses, confirmed via `Sense.sources`/`Sense.derivations` in the installed `ruwordnet` package's `models.py:61-74` — this one is sense-level, not synset-level, an API asymmetry vs. the others). `composition_relation` (word↔phrase) stays out of scope.
- **Two bugs found in the current pipeline while reading it directly (not from an agent summary) — the rewrite fixes both, they are not being carried forward**:
  - `scripts/python/process_words.py`'s `get_synonyms_and_antonyms()`: when a word matches multiple RuWordNet `senses`, the loop overwrites `synset_data = {...}` on every iteration instead of accumulating — only the **last** matched synset's hypernyms/meronyms/etc. survive into the exported JSON, the rest are silently dropped. (The separate flat `synsets` list is unaffected — it already dedupes correctly via a `seen` set.)
  - `scripts/db/upload-synonyms-antonyms.ts` does a bare `INSERT INTO synonyms/antonyms` with no existence check at all (not even the sibling script's flawed "delete-all-then-reinsert" — just unconditional insert) — reruns silently duplicate rows without bound.
  - Also refines the 48%-coverage-gap root cause found earlier: `RuWordNet.get_senses()` (`ruwordnet.py:54-57`) matches `lemma.upper().strip()` against `Sense.lemma`, a **pre-lemmatized** column distinct from `Sense.name` (raw surface form) — e.g. a synset's `name` "ВЫЧИТКА ТЕКСТА" has `lemma` "ВЫЧИТКА ТЕКСТ" (nominative, not genitive). So part of the gap is grammatical-form mismatch (our translation string's case/number vs. RuWordNet's lemmatized index), not just missing lemma variants — full fix would need Russian morphological normalization (e.g. pymorphy2), explicitly out of scope for this pass; only the "try other lemma variants of already-matched synsets" half is being built now.
- **NSM primes source, confirmed and cited** (do not use a secondary/blog aggregation): Cliff Goddard, "NSM Semantic Primes" (chart), 4 January 2011 — [PDF, Max Planck Institute repository mirror](https://cdstar.eva.mpg.de/bitstreams/EAEA0-C1BF-E247-4C8F-0/Goddard2011.pdf); cites Wierzbicka 1996, Goddard & Wierzbicka (eds.) 2002, and Goddard & Wierzbicka "Words & Meanings" (at the time "in press", published 2014) as key references. Extracted directly from the PDF, **this version has 64 primes, not the commonly-cited 65** (the "I, YOU" grid cell visually combines both primes into one chart box, but they are two distinct primes in the text) — the 65 figure is associated with later revisions (2018/2021); using this precisely-dated, precisely-cited 64-prime version was a deliberate choice over reconstructing a later table from paraphrased secondary sources. The 64, by standard NSM category:
  - Substantives (6): I, YOU, SOMEONE, PEOPLE, SOMETHING~THING, BODY
  - Relational substantives (2): KIND, PART
  - Determiners (3): THIS~IT, THE SAME, OTHER~ELSE
  - Quantifiers (6): ONE, TWO, SOME, ALL, MUCH~MANY, LITTLE~FEW
  - Evaluators (2): GOOD, BAD
  - Descriptors (2): BIG, SMALL
  - Mental predicates (6): THINK, KNOW, WANT, FEEL, SEE, HEAR
  - Speech (3): SAY, WORDS, TRUE
  - Actions/events/movement/contact (4): DO, HAPPEN, MOVE, TOUCH
  - Location/existence/possession/specification (4): BE (locational), THERE IS, HAVE, BE (specificational)
  - Life and death (2): LIVE, DIE
  - Time (8): TIME~WHEN, NOW, BEFORE, AFTER, A LONG TIME, A SHORT TIME, FOR SOME TIME, MOMENT
  - Space (8): PLACE~WHERE, HERE, ABOVE, BELOW, FAR, NEAR, INSIDE, ON ONE SIDE
  - Logical concepts (5): NOT~DON'T, MAYBE, CAN, BECAUSE, IF
  - Intensifier/augmentor (2): VERY, MORE~ANYMORE
  - Similarity (1): LIKE~WAY

See `scripts/db/seed-semantic-primes.ts` for how these 64 rows are actually seeded (English exponent as `englishText`, category as shown above, `sortOrder` following this table's order).

**Two other bugs found and fixed while rewriting the Python side** (beyond the `synset_data` overwrite bug already described above): `synset.related`/`synset.antonyms` in the `ruwordnet` package are themselves split into duplicated forward/reverse accessor pairs (`related`/`related_reverse`, `antonyms`/`antonyms_reverse` — same pattern as `pos_synonyms`/`pos_synonyms_reverse`, per the package's own comment "easier than dirty SQLAlchemy hacks"), and the original script only ever read the forward half — silently missing roughly half of each word's actual `related_relation`/`antonymy_relation` rows depending on which side of the underlying left_id/right_id pair it happened to land on. Fixed by unioning both halves for all three (`related`, `antonyms`, `pos_synonyms`) in the rewrite. Verified directly: `хороший` (good) now returns antonyms including `худший`, `нехороший`, `наихудший`, `плохой`, `худой`, `дурной`, `неудовлетворительный`, `плохонький`, `плоховатый` — a noticeably richer list than the pre-fix single-direction query would have produced.

**RESOLVED (2026-07-23): admin migrated, old 11 tables dropped.** What was deferred above is now done:
- `app/admin/relations/relation-config.ts` — `tableName` replaced by `relationType` + `direction?: 'outgoing'|'incoming'`; grew from 9 to 14 entries (added `pos-synonyms` [symmetric], `instance-of`/`instances` [direction pair], `derivation-targets`/`derivation-sources` [direction pair]) — new relation types got real admin UI, not left unmanaged.
- `app/admin/relations/[type]/page.tsx`, `app/admin/synonyms/page.tsx`, `app/admin/antonyms/page.tsx`, `app/admin/words/[id]/edit/page.tsx`'s "Отношения" tab (a second, independent read/write surface for the same 11 relation kinds, found only by grepping every caller of the old `lib/relations.ts` functions — would have silently diverged from the dedicated pages if left on the old tables), and `/api/word-relations/save` (that tab's save endpoint) all switched to the new `*SemanticRelation` functions.
- `app/words/[id]/api.ts` and `/api/synonyms/second-level` (word-detail-page synonym/antonym query and the `SynonymGraph.tsx` second-level lookup) switched to `fetchSymmetricSemanticRelations`.
- `config/features.ts` — existing 9 `*Edit` keys reused as-is (permission gating is about the action, not storage); added `PosSynonymsEdit`/`InstanceOfEdit`/`InstancesEdit`/`DerivationTargetsEdit`/`DerivationSourcesEdit` for the 5 new admin views, plus `SemanticPrimesManage` for the new `/admin/primes` page (minimal CRUD for `PrimeExponent` — the 64 `SemanticPrime` rows themselves stay a read-only seeded reference).
- **Found and fixed two bugs unrelated to the table swap itself, while tracing every real caller before touching anything**: (1) `synonyms-client.tsx`/`antonyms-client.tsx` crashed (`Cannot read properties of undefined (reading 'value')`) because the server sends `target: {..., lexeme: {...}}` but the client's `meaningDisplay` expected `word` — `relation-client.tsx` already had a `toSimpleMeaning`/`toTargetMeaning` converter pair for exactly this, the other two components never got it (fixed by adding the same converters, including in the post-save optimistic-update path, which had the identical mismatch one step later). (2) `components/AdminNav.tsx`'s "Отношения" dropdown was unclickable — it renders via `createPortal` into `document.body`, so the portaled menu is not a DOM descendant of the `onMouseEnter`/`onMouseLeave` wrapper around the button; moving the cursor onto a menu item fired `onMouseLeave` (and the outside-`mousedown`-closes handler, which also didn't recognize the portal as "inside") before the click could land. Fixed by adding a `menuRef` to the portaled div, checking both refs in the outside-click handler, and attaching the same hover handlers to the portal.
- **Found and fixed a third pre-existing bug while doing the final grep-every-caller pass before writing the DROP script**: `app/admin/deduplication/actions.ts`'s lexeme-merge logic (`mergeWordsAction`) rewired `synonyms`/`antonyms` using `UPDATE ... SET sourceId = ? WHERE sourceId = ?` with the function's own **lexeme**-id parameters — but `sourceId`/`targetId` on those tables are **meaning** ids, so this was already an ID-space mismatch (a silent no-op in practice, since a meaningId essentially never equals the lexemeId being merged). Fixed by rewiring `semantic_relations` using the already-correctly-computed `sourceMeaningIds`/`targetMeaningId` (the same ones the language-table merge logic a few lines above uses), via `UPDATE OR IGNORE` (skips a retarget that would collide with the unique `(sourceId,targetId,relationType)` index — that row is then cleaned up for free by the FK cascade when the source meanings get deleted a few lines later; better-sqlite3 has `foreign_keys=ON` by default, confirmed empirically) plus an explicit self-loop guard (`DELETE FROM semantic_relations WHERE sourceId = targetId`) for the edge case where both sides of a relation belonged to meanings of the same merged-away lexeme. Verified on a scratch DB with a deliberately-constructed conflict case before touching live data.
- Deleted the now-fully-dead `scripts/db/upload-synsets.ts`, `upload-synonyms-antonyms.ts`, `upload-synset-relations.ts` (superseded by `upload-ruwordnet.ts`) and their `package.json` entries (replaced with one `upload:ruwordnet` script); deleted the dead `fetchSymmetricRelations`/`saveSymmetricRelation` functions from `lib/relations.ts` (confirmed zero remaining callers by grepping the whole repo).
- Dropped all 11 old tables via `scripts/db/2026-07-23-drop-old-relation-tables.ts` (idempotent `DROP TABLE IF EXISTS`, backed up to `interlex.db.backup-before-drop-old-relations` first) and removed their Prisma models + `Meaning`'s 22 back-relation fields from `data.schema.prisma`. `prisma validate` + `npm run db:gen-data` + `next build` all clean afterward.
- The historical `scripts/db/2026-07-22-add-indexes-and-fts5-trigram.ts` (already applied to production, references the old table names in its `CREATE INDEX` statements) was deliberately left untouched — it documents what was actually run at the time; editing an already-applied migration script retroactively isn't the right fix.

### Key Files
- `prisma/data.schema.prisma` — `SemanticRelation`, `SemanticPrime`, `PrimeExponent` models
- `scripts/db/2026-07-23-add-semantic-relation-and-primes.ts` — deployment script (creates the 3 new tables + indexes) — idempotent, safe to re-run
- `scripts/db/seed-semantic-primes.ts` — seeds the 64 NSM primes — idempotent (upsert by `code`)
- `lib/relations.ts` — `fetchSymmetricSemanticRelations`/`saveSymmetricSemanticRelation` (symmetric types: synonym, antonym, related, pos_synonym) and `fetchOutgoingSemanticRelations`/`fetchIncomingSemanticRelations`/`saveDirectionalSemanticRelation` (directional types: hypernymy, meronymy, causation, entailment, instance_of, derivation) — the only functions in this file now; the old 11-table `fetchSymmetricRelations`/`saveSymmetricRelation` were deleted once every caller had migrated
- `scripts/python/process_words.py` — rewritten: fixes the `synset_data` overwrite bug (now `synset_data_list`, one entry per matched sense), fixes the `related`/`antonyms` forward-only bug, adds `posSynonyms`/`instanceOfClasses`/`hasInstances`/`derivationTargets`/`derivationSources`, adds ILI-based English gloss/lemma enrichment, adds a Ё/е normalization fallback for matching
- `scripts/db/upload-ruwordnet.ts` — replaced the now-deleted `upload-synsets.ts`/`upload-synonyms-antonyms.ts`/`upload-synset-relations.ts` (`npm run upload:ruwordnet`); additive Synset/MeaningSynset inserts unchanged, `semantic_relations` rows deduped in-memory before write, reimport scopes its delete to `source='ruwordnet_auto'` only
- `app/admin/relations/relation-config.ts` — 14 entries (`relationType`/`direction?` model), drives `app/admin/relations/[type]/page.tsx`
- `app/admin/primes/page.tsx` + `primes-client.tsx` — minimal `PrimeExponent` CRUD, gated by `Feature.SemanticPrimesManage`
- `scripts/db/2026-07-23-drop-old-relation-tables.ts` — dropped the 11 old tables once every caller was confirmed migrated (idempotent `DROP TABLE IF EXISTS`); the 11 old Prisma models and `Meaning`'s corresponding back-relation fields were removed from `data.schema.prisma` in the same pass

---

## Corpus Tokenizer: DbAnalyzer Architecture

### Overview
`DbAnalyzer` (`lib/corpus/tokenizer/dbAnalyzer.ts`) is the primary POS tagger for corpus tokens. It takes a surface form and returns a `MorphoAnalysis` with three possible outcomes depending on recognition confidence.

### Constructor
```typescript
new DbAnalyzer(queryWordsByBase: WordQueryFn, validEndings: Set<string>)
```
- `queryWordsByBase`: callback that fetches `WordBaseRecord[]` from DB by hypothetical stem bases
- `validEndings`: set of known ending strings from the `ending_allophones` database table (seeded by `scripts/db/seed-endings.ts`)

### Three Outcomes (Traffic Light)

| Color | Condition | `isPartialMatch` | `matchCount` | `feats` |
|-------|-----------|-------------------|--------------|---------|
| **Green** | `exactMatches.length > 0` (grammar engine generated a matching form) | `false` | `N` | Filled by grammar engine |
| **Yellow** | No exact match, but stem prefix matches | `true` | `1` | `{}` (empty) |
| **Red** | No match at all | `null` (analyzeWord returns `null`) | 0 | `{}` |

### Core Algorithm

1. **`generateHypotheticalBases(clean)`**: Iterates ending lengths `0..MAX_END_LEN` (4), filtering candidates where the ending is in `validEndings` (or endLen=0). Stem must be ≥1 char (with exception for 0-ending: prepositions like "k", "v", "s" pass through).

2. **`matchForms(clean, words)`**: Calls `generateWordForms()` from the grammar engine for each candidate word, passing `flavor: word.flavor || 'CORE'` into `EngineWordInput`. Compares normalized surface forms. Returns all exact matches.

3. **`matchByStemPrefix(clean, words)`**: Fallback when grammar engine generates wrong endings (see Known Issue). Checks if surface form starts with `word.stem` (or `word.base`). Among candidates, prefers stems shorter than surface form (real word + ending) over stems equal to surface form. Selects longest matching stem.

### Flavor System (Regional Variants)
Words linked to multiple lexemes via `base_homonyms` table (JSON `wordIds` field) can specify regional flavor:
- `wordIds` stored as JSON array: `[123, 456]` (all CORE) or `[{id: 123, flavor: "CORE"}, {id: 456, flavor: "EAST"}]`
- `WordBaseRecord.flavor` passed through to `MorphoAnalysis.flavor` and to `EngineWordInput.flavor` in `matchForms`
- Currently verb/adj processors skip flavor (only CORE)

### validEndings Set
Populated from `ending_allophones` table (seeded by `scripts/db/seed-endings.ts`):
- Entries stored with `stemType`, `grammeme`, `value`, `flavorId`
- Current seed: 450 CORE endings covering noun stem types (o_hard, o_soft, a_hard, a_soft, u_basis, i_basis, consonant_n, consonant_s), adjective (adj_hard, adj_soft), and verb forms (present, aorist, imperfect, imperative, l-participle, active/passive participles), plus numeral/collective/adverb endings

### RESOLVED (2026-07-24): Grammar Engine Was Producing Wrong Endings

**Original problem**: The grammar engine (`lib/grammar/morphology/`) generated etymological Proto-Slavic endings (jers `ъ`/`ь`, nasal `ǫ`) that didn't match modern Interslavic forms. For example, `voda` (ā-stem, FEM, paradigm A) generated Acc sg `vodaǫ` instead of `vodu`.

**What we found**: The live `ending_allophones` DB table was NOT the "decoy" it first appeared to be — moderators had been manually correcting individual (stemType, grammeme) entries via `/admin/endings` for a while, and `getEnding()`/`getEndingByGrammeme()` in `endingLoader.ts` DO consult the DB before falling back to the hardcoded registries. So the *live* site was already serving mostly-correct noun endings; it was the **hardcoded registries** (used as the DB-unavailable fallback, and by `scripts/db/seed-endings.ts` to seed fresh databases) that still held the original Proto-Slavic values — a fresh install or a test run with no DB would still get the bug.

**Fix applied**:
- Extracted the corrected values straight from the live `ending_allophones` table and rewrote `SLAVIC_ENDINGS_REGISTRY` in `lib/grammar/endingsRegistry.ts` (all 8 noun stem types — fully corrected in DB, 100% coverage) and one entry in `ADJECTIVE_ENDINGS_REGISTRY` in `lib/grammar/adjective/index.ts` (FEM accusative singular).
- Applied the same jer-stripping pattern by analogy to `numeral_three`/`numeral_four` (confirmed with the project maintainer) and to the present-active-participle `-ǫšti/-ǫťa/-ǫťe/-ǫťi` endings (same nasal-vowel fix as below).
- **Separately discovered and fixed**: the nasal vowel has two orthographic representations in this codebase — `ǫ` (o+ogonek, Proto-Slavic-style) and `ų` (u+ogonek). Confirmed with the maintainer that **`ų` is the correct modern form**. Migrated `ǫ→ų` across every place that generates or displays modern ISV text: `lib/isv.ts` (`standardToSimple`, `isvToTranscription`, `isvToGlagolitic`, `standardToSimpleCyr`), `lib/flavors.ts` (`generateWestFlavor`), `lib/transliteration.ts` (`detectScript`, `etymCyrToEtymLat`, `etymLatToStdLat`). Left `lib/proto.ts` alone — it already correctly outputs `ų` on its Proto-Slavic→Interslavic conversion path, and its *input* side legitimately deals in real Proto-Slavic `ǫ`/`ǭ`. `lib/nsl.ts` and the various vowel-detection regexes in `stress.ts`/`accentUtils.ts`/`encliticEngine.ts`/`fourTonesGenerator.ts`/`numerals/*`/`pronoun/index.ts` already handled both characters — no change needed there.
- **Found and removed dead duplicate code** while investigating: `lib/grammar/noun/index.ts` had its own unused `SLAVIC_ENDINGS_REGISTRY` export (same name as the real one, zero importers — deleted); `lib/grammar/adjective/adjective.ts` was an entire orphaned duplicate of `adjective/index.ts` (zero importers — deleted).
- A separately-hardcoded fallback in `lib/grammar/numerals/cardinal.ts` (`SMALL_NUMBERS_REGISTRY.three`/`.four`) still had the old `ьjъ/ьmъ/ьmi/ьxъ` endings even after the DB and `seed-endings.ts` were fixed — updated to `ej/em/emi/eh` to match.

**2026-07-25: consolidated the verb conjugator** (see also the `verb/index.ts` vs `verb/conjugator2.ts` note above, which was superseded by this). They were not dead duplicates — both were live, `verb/index.ts` used by the engine (`processVerb`) and `verb/conjugator2.ts` used directly by `app/words/[id]/Word.tsx` — but had drifted:
- `conjugator2.ts` silently ignored `VerbModel.tertiaryStem` (used `infStem` instead), producing a wrong l-participle — and everything built from it (perfect, pluperfect, conditional) — for any verb whose l-participle stem differs from its infinitive stem (e.g. "byti" → tertiaryStem "by-", "dojdti" → tertiaryStem "doš-"). Verified on the live DB: `dojdti` now correctly gives l-participle `dóšl` instead of the old `dójdl`.
- `Word.tsx` was never passing `paradigm` into the call at all (even though `item.paradigm` was already being read into `meta` two lines above), and passed `aspect: meta.aspect || 'imperfective'` — a string that never matched anything, since `lexemes.aspect` is stored as `'IPF'/'PF'/'BI'` (the `VerbalAspect` enum) — meaning `futureAnalytical` (the "will do" future-tense forms) was silently never generated on the word-detail page for any verb, regardless of its real aspect. Both fixed as part of this change.
- Deleted as fully dead (zero importers each): `lib/grammar/verb/conjugator.ts` (an earlier, pre-DB-integration draft — no accent system, no participles, wouldn't even satisfy its own `ConjugationResult` type), `lib/grammar/verb/auxiliary.ts` and `lib/grammar/verb/types/conjugator.ts` (only used by the two deleted conjugator files), `lib/grammar/verb/addToneSyllable.ts`, and the now-orphaned `extractProtoStems`/`ExtractedStems` in `lib/grammar/morphonology.ts` (that file's `applyFirstPalatalization`/`applyIotation` are still used elsewhere and were kept).
- `Word.tsx` and `VerbConjugationTables.tsx` now both import from `verb/index.ts` — single source of truth.

**Still open / explicitly out of scope for this pass**:
- `lib/grammar/morphology/morphology.test.ts` and `lib/grammar/__tests__/declineNoun.test.ts` are not wired to any test runner (no vitest/jest) — see "No working automated tests" below. `morphology.test.ts`'s other 9 failing assertions (verb/adjective/numeral/pronoun accent placement, adverb comparative, noun stem-extension) are a **separate, pre-existing bug in the four-tones accent engine**, confirmed unrelated to this endings fix (same failures reproduce against the pre-fix DB backup). `declineNoun.test.ts`'s fixtures still assert old Proto-Slavic forms and haven't been updated — low priority since nothing executes them yet.
- Verb present/aorist/imperfect/imperative endings and `numeral_two`/`collective_oje`/`collective_ero` were checked against the DB and found to already match the hardcoded registry (i.e., apparently never needed correction — no jers found in their values) — not independently verified by a linguist, just "nothing to fix by this method."
**2026-07-25: fixed both cardinal.ts issues above, plus the same underlying gap in noun declension:**
- `lib/grammar/numerals/cardinal.ts`'s paradigm-B tautology (`fullForm.endsWith('ъ')||endsWith('ь')||endsWith('')` — the last clause is always `true` in JS) — replaced with tracking the actual `usedEnding` value per strategy and checking that directly.
- The numerals-5-10 nominative over-suffixing (`pęťj` instead of `pęť`) — root cause was that `normalizeSoftConsonants`/`collapseDoubleJ` (`lib/isv.ts`), already used by the engine (`morphology/engine.ts`) to simplify redundant softness marking, was never applied in `cardinal.ts`. Extended `normalizeSoftConsonants` with one more rule (soft-consonant char directly followed by literal `j` collapses to just the soft-consonant char — `pęťj→pęť`, `noćj→noć`) and now call `collapseDoubleJ(normalizeSoftConsonants(fullForm))` before tone-marking in `generateNumeralForm`.
- **Found the identical gap was live for real nouns, not just numerals**: `lib/grammar/declineNoun.ts`'s `declineWordAutomatically` (the function `app/words/[id]/page.tsx` actually calls) never applied this normalization either — confirmed on the live DB with "noc" (night, stem `noć`): nominative was `nòćj` (should be `nòć`), genitive was `nòći` (should be `nòči` — `ć` before a soft vowel simplifies to `č`). Fixed the same way. This means any i-stem/o-soft noun whose `stem` field carries an explicit soft-consonant character (ť/ď/ň/ľ/ś/ź/ć/đ) was rendering wrong on real word-detail pages until this fix.
- Also: `Word.tsx` was passing `item.value` (citation form, e.g. `"pet"`) to `NumeralDeclensionTables` instead of `item.stem` (which may carry the soft marker, e.g. `"pęť"`) — the same `item.stem || item.value` pattern nouns already used. Fixed. Note this only helps where the DB row's `stem` is populated correctly — some numeral lexeme duplicates in the DB have a bare/hard stem (e.g. `"pet"` with no soft marker at all), which is a data quality issue no amount of code can fix; that duplicate will still render `pètj`-style until the data itself is corrected or merged.

### Key Files
- `lib/corpus/tokenizer/dbAnalyzer.ts` — Core DbAnalyzer class
- `lib/corpus/tokenizer/types.ts` — `MorphoAnalysis` with `flavor` field
- `lib/corpus/tokenizer/morphology.ts` — Static fallback analyzer (used when DbAnalyzer returns null)
- `lib/corpus/tokenizer/index.ts` — Exports (does NOT export `createBaseQuery`)
- `app/api/corpus/analyze/route.ts` — API endpoint with lazy `getAnalyzer()` singleton; now requires `Feature.CorpusBuilder` (fixed 2026-07-22, was unauthenticated)
- `app/api/corpus/save/route.ts` — Save endpoint with lazy `analyzerPromise`; requires `Feature.CorpusBuilder`
- `scripts/db/seed-endings.ts` — Seed script for `ending_allophones` table. Now seeds the corrected modern-ISV values (fixed 2026-07-24) — safe to re-run
- `lib/grammar/morphology/engine.ts` — `generateWordForms()`, `stripCombiningAccents()`
- `lib/grammar/endingsRegistry.ts` — Modern ISV noun endings registry (fixed 2026-07-24, was Proto-Slavic)
- `lib/grammar/adjective/index.ts` — Adjective endings registry
- `lib/grammar/verb/index.ts` — the single verb conjugator (engine + word-detail-page both use this now, since 2026-07-25)

---

## Security & Data-Integrity Audit (2026-07-22)

A full audit found and fixed the following (Phase 1 — see [ARCHITECTURE.md](ARCHITECTURE.md) "Known Issues & Technical Debt" for the complete list including still-open items like the grammar engine ending bug, non-bidirectional relations, missing DB indexes, and lack of test coverage):
- SQL injection in `app/api/lexicon/services.ts` search (was string-interpolated, now parameterized).
- Missing permission check on `POST /api/word-relations/save` (was session-only; now checks the relation-specific `Feature`).
- Unauthenticated `POST /api/synonyms/second-level` and `POST /api/corpus/analyze` (now require a session / `Feature.CorpusBuilder`).
- Non-constant-time HMAC comparison in Telegram auth (`auth.config.ts`, now uses `crypto.timingSafeEqual`).

When adding new API routes that mutate lexical or relation data, follow the pattern in `app/api/roots/[id]/route.ts` or `app/api/endings/route.ts`: `auth()` + `checkPermission(session, Feature.X)` returning `403`, not just a session-presence check.

---

## Corpus Syntax Parser (UD dependency graph, 2026-07-27/28)

Builds a Universal Dependencies–style dependency graph over already-tokenized corpus sentences — one edge per non-root token (`headTokenId=null` marks the clause root), stored in `CorpusDependency` (`corpus.db`). Deliberately a *separate* pass from POS-tagging/reanalysis: it reads existing `CorpusToken.lemma/pos/feats` and only builds edges, so it's much cheaper to re-run and doesn't retag anything.

**Schema** (`prisma/corpus.schema.prisma`, raw-SQL migration `scripts/db/2026-07-27-add-corpus-syntax-tables.ts` — same reason as always, no `_prisma_migrations` table in `corpus.db`):
- `CorpusDependency`: `sentenceId`, `headTokenId` (nullable, null only for root), `depTokenId` (`@unique` — a token has exactly one head, this is the tree-shape guarantee), `relation` (canonical UD deprel string), `confidence` (`'rule'|'heuristic'|'unresolved'` — same traffic-light naming convention as `DbAnalyzer`'s green/yellow/red), `source` (`'auto'|'manual'`).
- `VerbGovernment`: `verbLemma`, `reflexive`, `requiredCase`, `role` (`'obj'|'iobj'|'obl'`), `priority`. **Intentionally seeded empty** — same principle as the endings work: "a verb X governs case Y" is a linguistic fact that isn't fabricated by a script, only entered by a moderator (future admin) or a verified import. `getVerbGovernment()` (`lib/corpus/syntax/government.ts`) lazily loads it from `corpus.db` via `better-sqlite3` (guarded by a `typeof window` check, safe to import from client code) and falls back to an empty `VERB_GOVERNMENT_FALLBACK` map — so today every government-dependent code path (clause-role labeling, the homonym-disambiguation Pass C below) degrades gracefully to a weaker heuristic rather than fabricating case facts.

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

---

## Corpus Homonym Disambiguation (2026-07-28/29, Phases 1–5)

Before this work, `DbAnalyzer.analyzeWord` (see "Corpus Tokenizer: DbAnalyzer Architecture" above) found every grammatically-possible lexeme for an ambiguous surface form (`matchCount > 1`) but kept only an arbitrary DB-order winner — the other candidates were computed and immediately discarded, so there was nothing to disambiguate *against* later, and no way to review or correct a wrong pick short of re-running the whole analyzer. Real scale at the time this was built: 636,724 corpus tokens, 143,949 of them ambiguous (`matchCount > 1`).

**Phase 1 — persist the full candidate set.** New `CorpusTokenCandidate` table (`tokenId`, `wordSlug`, `lemma`, `pos`, `feats`, `flavor`, `score`, `source`, `rank`), one row per grammatically-possible reading, written alongside the winning `CorpusToken` row at every write site (`upsertDocument.ts`, `app/api/corpus/save/route.ts`, `lib/corpus/reanalyzeDocument.ts`). `CorpusToken.resolutionSource` (`'auto'|'manual'`) added as the same reimport-safety guard used elsewhere (`CorpusDependency.source`, `semantic_relations.source`) — reanalysis skips any token a moderator has already resolved by hand, including refusing to retag a whole collocation span if any member token in it is `'manual'`. Migration: `scripts/db/2026-07-28-add-corpus-token-candidates.ts`.

**Phase 2 — rank candidates instead of picking DB order.** `DbAnalyzer.analyzeWord` now takes an optional `{leftNeighbor}` context (threaded from the previous raw token in `tokenizer.ts`/`reanalyzeDocument.ts`) and scores every candidate: `Lexeme.corpusFrequencyPerMln * CASE_WEIGHTS[case]`, plus a ±1,000,000 bonus/penalty if the immediately preceding word is a known preposition and the candidate's case does/doesn't match its government (`getExpectedCasesForPreposition`) — government is treated as near-grammatical-law, so it dominates frequency rather than blending with it. Two pre-existing gotchas found and worked around, **not fixed** (both out of scope, bigger blast radius):
- `lib/corpus/priorities/{coldStart,hotUpdate,dictionaryLoader}.ts` (an earlier, unfinished attempt at frequency-based ranking) turned out to be **non-functional** — `import { PrismaClient } from '@prisma/client'` doesn't resolve at all in this project's four-separate-generated-clients setup (confirmed: `require('@prisma/client')` throws `Cannot find module '.prisma/client/default'`). Bypassed entirely in favor of the already-shipped `Lexeme.corpusFrequencyPerMln`, which also sidesteps a circularity `hotUpdate.ts` would have had (it computed frequency from `CorpusToken.lemma`, i.e. from the very same arbitrary winners being replaced).
- The grammar engine emits case values as **long-form English words at runtime** (`'nominative'`, via `lib/grammar/endingsRegistry.ts`'s `Case` const), while `CASE_WEIGHTS`/`PREPOSITION_GOVERNMENT`/`GrammaticalCase` (`lib/grammar/common/case.ts`) use **short codes** (`'nom'`). Two parallel case-naming conventions coexist in this codebase (also visible as a latent display bug in `TokenSidebar`/`CorpusTokenDisplay`'s `FEAT_LABELS`, which only recognize the short codes). Not unified here — normalized locally via `lib/corpus/tokenizer/caseNormalize.ts`'s `normalizeCaseValue`, used by both `DbAnalyzer` and the syntax-based Pass C below.
- Verified effect on real data: re-running reanalysis changed the winner on 5,980 of 143,949 ambiguous tokens (~4.2%), 0 previously-unambiguous tokens affected. Sample flips were linguistically sound (e.g. `byla`/`bylo` "was" now resolves to the verb `byti` instead of an unrelated `ADJ` homograph that used to win on DB order).

**Phase 3 — document-level flavor bias.** `lib/corpus/tokenizer/flavorBias.ts`'s `applyDocumentFlavorBias`: tallies flavor across a document's *unambiguous* tokens, and if one non-`CORE` flavor dominates, gives its matching candidates a +10,000 bonus (weaker than the government bonus above, stronger than raw frequency) and re-ranks. Currently near-inert in production — `interlex.db` has only 3 non-`CORE` flavor tags total (all on one lexeme), nowhere near enough for any real document to have a "dominant" non-CORE flavor yet — but verified correct against synthetic data (5 unambiguous WEST tokens flip an ambiguous candidate's ranking; a control with only CORE tokens is a no-op).

**Phase 4 — resolve via real syntax, not just the left neighbor.** `lib/corpus/resolveHomonymsViaSyntax.ts`: for tokens still ambiguous after Phases 2–3, looks up their `CorpusDependency` edge (if `relation` is `obj`/`iobj`/`obl`), resolves the governing verb's lemma + reflexivity (via an `expl`-relation edge pointing at it), and re-scores candidates against `getVerbGovernment()` — the same ±1,000,000 government bonus pattern as Phase 2, just driven by a real parsed head-dependent edge instead of "whatever token happens to be immediately to the left." Requires syntax parsing (see previous section) to have already run. Currently a no-op on real data too, for the same reason `VerbGovernment` is empty by design — verified against a real document's 400 `CorpusDependency` edges (37 `obj`/`iobj`/`obl` roles correctly found and traced to their governing verbs) and against a synthetic injected `VerbGovernment` rule (via `loadVerbGovernmentOverridesSync`) to confirm the rescoring itself works.

**Phase 5 — manual resolution UI.** `TokenSidebar.tsx`'s homonymy panel now lists real `CorpusTokenCandidate` rows (lemma/POS/feats/score/source) with a "Выбрать" action per candidate, plus a collapsible free-form "Указать вручную" section (lexeme search via the existing public `/api/lexicon?search=`, plus case/number/gender dropdowns) for assigning a lexeme+grammeme combination that isn't among the generated candidates at all. Both paths hit `POST .../tokens/[tokenId]/resolve` (logic in `lib/corpus/resolveTokenHomonym.ts`, following the Phase-1 pattern of keeping route handlers thin so the business logic is directly testable), which sets `matchCount=1`, `resolutionSource='manual'`, marks the chosen candidate `source='manual'`/`rank=0` and **does not delete the other candidate rows** (kept for audit/history). New `Feature.CorpusTokenDisambiguate` permission gates both the resolve route and its companion `GET .../tokens/[tokenId]/candidates` read route.

**Bulk scripts** (build the analyzer/collocation-matcher once, loop every document — rebuilding per-document would repeatedly re-scan the whole lexicon): `scripts/db/2026-07-28-reanalyze-all-documents.ts`, `scripts/db/2026-07-28-resolve-homonyms-syntax-all-documents.ts`.

**Deployment gotcha, hit for real**: after running a schema migration against `corpus.db`/`interlex.db`, a **process restart is required**, not just a code/file deploy — a long-running `next dev`/`next start` process keeps the previously-loaded Prisma client (built from the pre-migration schema) in memory, so a query referencing a just-added column throws `Unknown argument <column>` even though the column genuinely exists on disk and the generated client source files are up to date. Always restart the app process as a distinct step after any raw-SQL schema migration script, before running any code path that depends on the new column/table.

### Key Files
- `prisma/corpus.schema.prisma` — `CorpusTokenCandidate` model, `CorpusToken.resolutionSource`
- `scripts/db/2026-07-28-add-corpus-token-candidates.ts` — idempotent raw-SQL migration
- `lib/corpus/tokenizer/dbAnalyzer.ts` — `scoreMatch`, `AnalyzeContext`, candidate ranking
- `lib/corpus/tokenizer/caseNormalize.ts` — long-form ↔ short-code case normalization
- `lib/corpus/tokenizer/flavorBias.ts` — `applyDocumentFlavorBias`
- `lib/corpus/resolveHomonymsViaSyntax.ts` — Pass C
- `lib/corpus/resolveTokenHomonym.ts` — manual resolve business logic
- `lib/corpus/reanalyzeDocument.ts` — shared reanalysis logic (used by both the single-document admin button and the bulk script)
- `components/TokenSidebar.tsx` — manual resolution UI
- `config/features.ts` — `Feature.CorpusTokenDisambiguate`

---

## Valency Preposition Links (2026-07-29)

`ValencyArgument.preposition` (free-text `String?`, part of the multi-valency model added 2026-07-25 — see `ValencyFrame`/`ValencyArgument` in `prisma/data.schema.prisma`) had no structural link to an actual preposition lexeme — moderators typed it, or (more commonly, since the field was never actually used — confirmed 0 of 203 existing `valency_arguments` rows had any `preposition` text at all) the preposition stayed embedded directly in the lexeme's own `value` instead (e.g. a `VERB` lexeme literally valued `"pristupati do"`, a separate lexeme `"pristupati k"` for the other government pattern — an artifact of the earlier `Lexeme.governsCase` → `ValencyFrame` migration, which only carried over the bare case, never the preposition text, since the legacy data never captured it structurally).

**New FK**: `ValencyArgument.prepositionLexemeId` (→ `Lexeme.id`, `onDelete: SetNull`) — migration `scripts/db/2026-07-29-add-valency-preposition-lexeme-fk.ts`. `preposition` (text) is kept, now as a display-text cache synced whenever a link is chosen, so existing read paths (`Word.tsx`, `app/words/[id]/api.ts`) needed zero changes.

**UI**: `ArticleForm.tsx`'s `PrepositionPicker` replaces the old free-text `<input>` — fetches the full `pos=ADP` lexeme list once (`GET /api/lexicon/prepositions`, alphabetical), filters client-side as you type (the list is small, no server-side search needed), selecting an option sets `prepositionLexemeId` + the synced display text together via a dedicated `selectValencyPreposition` handler (not the generic single-field `updateValencyArgument`, since a selection changes two fields atomically).

**Two-script migration pipeline, run in this order** (both dry-run by default, `--apply` to write, per-lexeme audit-logged):
1. `scripts/db/2026-07-29-extract-embedded-preposition-from-lexeme-value.ts` — finds `VERB`/`ADJ` lexemes whose `value`'s trailing word matches a known preposition surface form, and **only auto-processes the unambiguous case**: exactly one `Meaning` → one `ValencyFrame` → one `ValencyArgument` (the bare-case row left over from the `governsCase` migration) to attach the preposition to. Lexemes with **zero** existing valency frames are deliberately left untouched and only listed in the report — inferring what case they govern would mean fabricating a linguistic fact, the same principle as `VerbGovernment` being seeded empty (see Syntax Parser section). Lexemes whose `value` contains a comma (bundled spelling variants, e.g. `"sȯocati se s, suocati se s"`) are also flagged rather than guessed at. Real run: 33 auto-extracted, 19 flagged (no frame), 2 flagged (comma variants).
2. `scripts/db/2026-07-29-merge-preposition-duplicate-lexemes.ts` — finds `(value, pos)` groups of 2+ lexemes where at least one member has a preposition link, picks the richest member (most non-null grammar fields, tie-break lowest id) as merge target, and moves every other member's `Meaning` rows onto it — **preserving each `Meaning` as its own row** rather than collapsing them into one. This is the key difference from `lib/dedup/mergeLexemes.ts` (the existing `/admin/deduplication` merge, which finds/creates a single target `Meaning` and deletes the rest) — that function would have destroyed exactly the per-preposition distinction this feature exists to capture, so a new, narrower merge routine was written instead of reusing it. Since meanings keep their own row, `translations`/`semantic_relations` (both `meaningId`-scoped) need zero rewiring — only `lexemes_morphemes`, `inflection_anomalies`, `lexeme_allophones` (via `UPDATE OR IGNORE`, unique-constraint collisions left for cascade cleanup on delete) and `base_homonyms.wordIds` membership move to the target. `slug` is deliberately **not** renamed on merge, to keep existing `/words/<slug>` links stable, even though the target's slug may no longer textually match its post-extraction `value`. Real run: 13 lexemes merged into 12 targets (0 orphaned meanings, 0 dangling FK refs afterward).

**Bug found and flagged, not fixed** (out of scope, own follow-up task): `lib/dedup/mergeLexemes.ts`'s `base_homonyms` cleanup assumes `wordIds` is always the old flat `number[]` format; 4 of 33,746 real rows already use the newer `{id, flavor}[]` format (see the Flavor System note under "Corpus Tokenizer" above) and are silently skipped by that cleanup. The new merge script above handles both formats.

### Key Files
- `prisma/data.schema.prisma` — `ValencyArgument.prepositionLexemeId`, `Lexeme.valencyArgumentsAsPreposition`
- `scripts/db/2026-07-29-add-valency-preposition-lexeme-fk.ts` — idempotent raw-SQL migration
- `app/api/lexicon/prepositions/route.ts` — full ADP lexeme list
- `components/ArticleForm.tsx` — `PrepositionPicker`, `selectValencyPreposition`
- `lib/valency.ts` — `syncValencyFramesForMeaning`, now also persists `prepositionLexemeId`
- `scripts/db/2026-07-29-extract-embedded-preposition-from-lexeme-value.ts` — dry-run/`--apply` extraction
- `scripts/db/2026-07-29-merge-preposition-duplicate-lexemes.ts` — dry-run/`--apply` merge (meanings preserved, not collapsed)

---

## RESOLVED (2026-07-25/26/27): Noun Declension Had Two Parallel Engines, Now One

Three consecutive commits (`declension fixes`, `accentology fix`, `canonical gender animacy`) each had to fix the *same* bug twice, in two different files, because noun declension existed as two independently-maintained implementations: **"Stack A"** (`lib/grammar/declineNoun.ts` + `lib/grammar/stemClassifier.ts` + `lib/grammar/fourTonesGenerator.ts`, used by the live word page) and **"Stack B"** (the old `lib/grammar/noun/index.ts`, used only by the corpus tokenizer's `processNoun()`).

**Bugs fixed in both stacks along the way:**
- `identifyStemTypeByDb()` compared `protoStemClass`/`stemExtension` against the TS enum's descriptive uppercase values (`ProtoStemClass.O_SHORT`), but the DB stores short lowercase Slavistic codes (`'o'`, `'jo'`, `'consonant'`...) — **the comparison never matched a single real word**, silently falling through to defaults every time. Fixed by lowercasing both sides before comparing.
- `Lexeme.animacy` was stored `'ANIM'` (uppercase) but the ending-override lookup (`ending_allophones`, keyed by UD grammeme strings like `'Animacy=Anim'`) expected `'Anim'` — **every animate-masculine noun's accusative singular silently fell back to the inanimate ending** (e.g. "vlk" instead of "vlka"). Fixed by canonicalizing `GrammaticalGender`/gender+animacy values to UD casing (`'Masc'/'Fem'/'Neut'`, `'Anim'/'Inan'`) project-wide, plus a one-time data migration (`scripts/db/2026-07-26-canonicalize-gender-animacy.ts`, idempotent, auto-backs-up to `interlex.db.backup-before-gender-animacy-canonicalization`) rewriting existing `lexemes.gender`/`animacy` values (including nulling out the non-UD `gender='verb'` on 804 verb rows).
- Two new noun classes added — `consonant_ent` (young-animal nouns, *telę*→stem *telent-*) and `consonant_er` (kinship terms, *mati*→stem *mater-*) — via a shared `stemWithExtension()` helper that inserts the historical stem augment between stem and ending outside nom./acc./voc. singular.
- Sonorants `r/l/n` before `j` were falling through to the wrong iotation rule (labial `+lj` or a generic table) instead of the correct `+j` (no epenthetic `l`) — added an explicit `SONORANTS_APPEND_J` branch in `lib/grammar/morphonology.ts`/`verb/index.ts::applyIotation`, verified against "govoriti"→"govorjut" etc.
- `processNoun()` (the corpus-engine path) was passing the full citation form as the declension root — for stem types where the citation form already contains the nominative ending (neuter o-stems like "selo"), this double-appended the ending ("seloo"). Fixed by passing `word.stem || word.isv`, matching the convention Stack A already used.

**Resolution**: `lib/grammar/noun/index.ts` (383 lines) was deleted outright once `processors.ts::processNoun` was switched to call `declineWordAutomatically` (Stack A) directly. **There is now exactly one noun declension engine** — any future noun-declension change only needs to touch `declineNoun.ts`/`stemClassifier.ts`/`fourTonesGenerator.ts`, not two places.

**Also from this batch, an ongoing pattern worth knowing**: `lib/grammar/stress.ts::resolveStressOverride()` is now the single entry point for per-lexeme (`stressPosition`) and per-morpheme (stressed-suffix) accent overrides, threaded through *every* POS generator (noun, verb — including participles, which previously got no accent marks at all — adjective, pronoun, numeral cardinal/collective/ordinal, determiner). A new word class's generator needs to call this to respect stress overrides, or loanword accentuation will silently use hardcoded defaults. Also fixed in the same pass: verb paradigm-C present-tense retraction was using tone `'short'`/`'grave'` instead of `'neoacute'` (Dybo's law + Ivšić's law actually produce neo-acute — `lib/grammar/verb/index.ts::conjugateFullVerb`).

### Key Files
- `lib/grammar/declineNoun.ts`, `lib/grammar/stemClassifier.ts`, `lib/grammar/fourTonesGenerator.ts` — the single noun engine
- `lib/grammar/common/gender.ts` — canonical UD gender values
- `scripts/db/2026-07-26-canonicalize-gender-animacy.ts` — one-time data migration, idempotent
- `lib/grammar/stress.ts` — `resolveStressOverride`
- `lib/grammar/adjective/index.ts::classifyAdjectiveType` — also unified (was duplicated inline in both stacks)

---

## Corpus Crawlers & Collocations (2026-07-27/28)

**Crawler pattern**: `lib/corpus/upsertDocument.ts::upsertCorpusDocument()` is the shared idempotent primitive behind four corpus crawlers (`scripts/crawl-isv-wikipedia.ts`, `crawl-interslavic-news.ts`, `crawl-izvesti-info.ts`, `crawl-kolozor.ts`, each with a matching `lib/corpus/{wikipedia,sources}/*Client.ts`). Each `CorpusDocument` carries `externalId` (e.g. `"iswiki:<pageId>"`, `@unique`) and `sourceRevisionId` — re-running a crawler skips pages whose source revision hasn't changed; a changed/new page's `segments`/`sentences`/`tokens` are deleted and recreated in one transaction, so tokens never accumulate across re-runs. Notable source-specific quirks handled in `lib/corpus/sources/`: `mojibake.ts::repairMojibakeUtf8` fixes interslavic.news's Windows-1252-in-UTF-8 mangling (affected ~75% of sampled articles), `htmlText.ts::filterLatinParagraphs` drops paragraphs where Cyrillic characters outnumber Latin ones (izvesti.info publishes parallel Latin/Cyrillic text, and the grammar engine only understands Latin orthography).

**Collocations**: `Lexeme.isCollocation` marks multi-word lexemes without a single inflectional paradigm (idioms/set phrases) as invariant. `lib/corpus/tokenizer/collocationMatcher.ts::CollocationMatcher` greedily matches 2–4-token phrases *before* the per-token analyzer runs. **Known limitation**: matches only the exact normalized surface form — does not account for inflection of the phrase's internal components (e.g. a phrase with a noun that should decline mid-idiom won't be matched in its declined form). Backfilled onto existing data via `scripts/db/2026-07-28-backfill-collocation-flag.ts` (explicitly recommends manual review afterward via `/admin/words` for false positives — not fully verified).

**Important carve-out — NOT collocations**: multi-word *verbs* whose tail is only `se`/`sę` and/or a known preposition (e.g. "zaruciti se", "bazovati na" — see "Valency Preposition Links" above for more on this exact pattern) conjugate normally on the head word; `lib/grammar/verb/mechanicalTail.ts` mechanically appends the tail to every generated form instead. Shared between the corpus engine (`processors.ts::processVerb`) and the word page (`Word.tsx`) so the two can't diverge on what counts as "mechanical" vs. a true frozen collocation.

**Tokenizer regex bug, exposed by the wikipedia crawler's prose** (`corpus fixes`, 2026-07-28): `lib/corpus/tokenizer/tokenizer.ts`'s token-splitting regexes were a hand-maintained character whitelist missing several ISV Latin diacritics (`ę, ų, ć, đ, ľ, ń, ś, ź, ť, ď, á, é, í, ó, ú, ý, ȯ`), splitting tokens like "atomų" into "atom"+"ų". Fixed by switching to Unicode property escapes (`\p{L}\p{M}\p{N}_`) instead of an enumerated charset — **don't reintroduce a hand-maintained character-class regex anywhere in the tokenizer**. All existing corpus documents were force-retokenized via `scripts/db/2026-07-28-retokenize-all-corpus-documents.ts` (re-runs `upsertCorpusDocument` on stored `rawText`, omitting `sourceRevisionId` from the payload to deliberately bypass the idempotency skip).

**RuWordNet: found a silent staleness bug, added a live per-word re-fetch.** `scripts/db/upload-ruwordnet.ts` (the batch pipeline) was still querying a standalone `ru` table that no longer existed after the 18-per-language-table→single-`translations`-table consolidation — meaning **the batch RuWordNet upload had been silently running against stale/broken data** until fixed (now queries `translations WHERE language='ru'`). Also added `lib/ruwordnet/applyEntry.ts` (shared, side-effect-free relation-computation logic extracted from the batch script) and a live "Сопоставить с RuWordNet" button (`app/api/admin/words/[id]/match-ruwordnet/route.ts`, `Feature.RuwordnetMatch`) that re-matches one word at a time — its relation writes are scoped to that one meaning's edges only (`source='ruwordnet_auto' AND (sourceId=meaningId OR targetId=meaningId)`), unlike the batch script's full-table delete+reinsert.

### Key Files
- `lib/corpus/upsertDocument.ts` — shared crawler idempotency primitive
- `lib/corpus/tokenizer/collocationMatcher.ts`, `lib/grammar/verb/mechanicalTail.ts`
- `lib/corpus/tokenizer/tokenizer.ts` — `TOKEN_PATTERN`/`PUNCTUATION_TEST`, now Unicode-property-based
- `lib/ruwordnet/applyEntry.ts`, `app/api/admin/words/[id]/match-ruwordnet/route.ts`
- `scripts/db/2026-07-27-add-corpus-source-fields.ts`, `2026-07-28-add-lexeme-collocation-field.ts`, `2026-07-28-backfill-collocation-flag.ts`, `2026-07-28-retokenize-all-corpus-documents.ts`

---

## Smaller changes from the same week, briefly

- **React remount-on-every-keystroke bug** (`article form fix`, 2026-07-26): `ArticleForm.tsx` had `SelectField`/`TextField`/`NumberField` defined *inside* the parent component's function body — a new component identity every render, so React unmounted/remounted the inputs (and lost focus/local state) on every keystroke. Moved to module scope. Generic React pitfall worth checking for if similar symptoms show up elsewhere.
- **Per-flavor verification tool**: `LexemeAllophone.verified` (`Int?`, migration `scripts/db/2026-07-28-add-lexeme-allophone-verified-field.ts`) plus a Tinder-style admin card UI (`/admin/word-cards`) for moderators to approve/reject a lexeme's CORE flavorization one at a time — explicitly modeled as the per-flavor analog of the existing `Translation.verified` / `/admin/translation-cards` flow.
- `components/ShareButton.tsx` (copy-link, on the word page) and `components/AccentLegend.tsx` (four-tone accent system explainer popover — rendered as `<span role="button">` rather than `<button>` because it's nested inside another button in `Word.tsx`, and nested `<button>`s are invalid HTML) — small, self-contained UI additions, no architectural follow-up.

---

## Corpus Candidate Proposals — auto-generating lexeme candidates from red/yellow tokens (2026-07-29)

Before this, a "red" token (`DbAnalyzer.analyzeWord` returns `null` — no lexeme's stem matches any hypothetical ending-stripped prefix of the surface form at all, `CorpusToken.matchCount=0`) or a "yellow" token (`matchByStemPrefix` found a real lexeme's stem but no generated form of its paradigm matched) was a dead end: the surface form was recorded and then nothing happened with it. This adds an automated pipeline that reconstructs plausible dictionary (citation) forms for these tokens and stages them for moderator review, without ever fabricating a linguistic fact — the design deliberately mirrors the "provisional automated match + explicit moderator resolve" shape already used for homonym disambiguation (`CorpusTokenCandidate`) rather than inventing a new pattern.

**New table** `CorpusCandidateProposal` (corpus.db, not interlex.db — avoids a cross-database join/transaction, same reasoning as `CorpusTokenCandidate`; `Candidate.id` is referenced as a plain non-FK `Int?`, the same convention `CorpusToken.wordSlug` already uses for cross-DB references). One row per **reconstruction hypothesis** for a cluster of tokens sharing the same normalized surface form (`clusterKey`), unique on `(clusterKey, ruleSource, guessedStemType, guessedGrammeme)`. Re-running the generator upserts — refreshes `occurrenceCount`/`exampleTokenIds`/`lastSeenAt`/`rank`/`possibleEndingGap` from current `CorpusToken` state, but the `UPDATE` clause never includes `status` — a moderator's `rejected`/`promoted`/`merged_into_existing` decision can never be reset or duplicated by a later regeneration, the same reimport-safety idiom as `CorpusToken.resolutionSource`/`CorpusDependency.source`/`semantic_relations.source` elsewhere in this project.

**Found a real gap while building this**: `CorpusToken` had no persisted `isPartialMatch` — both "yellow" (`matchByStemPrefix`, `matchCount=1`) and genuine "green" (exact match, `matchCount=1`) tokens serialized identically to disk, so yellow tokens were unqueryable after the fact. Added `CorpusToken.isPartialMatch` (migration + schema change bundled into the same `2026-07-29-add-corpus-candidate-proposals.ts` script, following the `2026-07-28-add-corpus-token-candidates.ts` precedent of bundling a small `CorpusToken` column addition with the main new table) and threaded it through all four write sites (`tokenizer.ts`, `upsertDocument.ts`, `app/api/corpus/save/route.ts`, `reanalyzeDocument.ts`). Existing tokens don't get it backfilled automatically — running `scripts/db/2026-07-28-reanalyze-all-documents.ts` populates it for a document going forward, same as `CorpusTokenCandidate`'s original rollout.

**Reconstruction algorithm** (`lib/corpus/candidates/reconstruct.ts`): for endings of length 0..4 (same perimeter as `DbAnalyzer.generateHypotheticalBases`), builds a reverse index of every `(stemType, grammeme)` pair in `ending_allophones` keyed by ending *value* (not by which lexeme it historically belongs to), so a matched suffix hypothesizes "this word might belong to stem class X" independent of any specific existing word. For each matched noun/adjective stem class, reconstructs the citation form (nominative singular) via the existing `getEnding()` — i.e. reuses already-moderator-corrected endings rather than inventing new inflection logic. **Deliberately out of scope, same "don't fabricate a linguistic fact" principle as `VerbGovernment`'s empty seed**: verb present/aorist/imperfect/imperative/participle stems (reconstructing an infinitive from a present-tense stem needs the thematic vowel/verb class, which isn't recoverable from the ending alone) and closed classes (`numeral_*`/`collective_*`/`adverb_comp`/`adverb_sup` — predicting a "new numeral" is nonsensical). The one verb exception: `verb_lpart` (l-participle) → infinitive via the standard `-l/-la/-lo` → `+ti` heuristic, since that mapping is reliable.

Yellow tokens run through the *identical* reconstruction algorithm (mechanically the same reverse-lookup — the known sibling stem doesn't change how reconstruction works, only that there's now a plausible relative to show the moderator) tagged `ruleSource='yellow_stem_sibling'` with `siblingWordSlug` attached. `possibleEndingGap` is auto-computed (not moderator-set): if a hypothesis's reconstructed stem exactly equals the sibling lexeme's own stem, that's a strong signal this is really a paradigm/ending bug on an *existing* lexeme, not a new word — surfaced as a warning in the UI so a moderator doesn't accidentally mint a duplicate lexeme for what's actually an `/admin/endings` fix.

**Admin UI** `/admin/corpus-candidates` (`Feature.CorpusCandidatesReview`), server-rendered/paginated (audit-log page's pattern, not `/admin/candidates`'s react-query pattern) — lists pending clusters by `occurrenceCount` descending (most-frequent-first, since the vast majority of red types are hapax). Approving a hypothesis materializes it into the existing `Candidate` staging table (`app/admin/corpus-candidates/actions.ts`) — deliberately **not** straight into `Lexeme`, preserving the existing `/admin/candidates` → `promoteCandidatesAction` review step. This is also, incidentally, the first code in the repo that actually *creates* `Candidate` rows — every prior reference to that table only read/promoted/deleted, nothing populated it.

**Validated against production data** (2026-07-29): 74,867 distinct surface forms covered (69,677 red + 5,190 yellow), 795,158 hypothesis rows, confirmed idempotent (re-running a slice produces zero row-count change).

**Three bugs found and fixed while validating against the real corpus, worth knowing about for any future bulk `scripts/db/*.ts` work**:
1. Punctuation tokens never get an explicit `matchCount` in their analysis branch (`tokenizer.ts`'s `isPunct` case has no `matchCount` field at all), so they default to `0` — identical to a genuine red token. `generateCorpusCandidateProposals` filters via `wordIndex: { not: -1 }` (the existing punctuation convention from `reanalyzeDocument.ts`) rather than fixing the tokenizer, since nothing before this feature ever queried `matchCount=0` in bulk. **A future `matchCount=0` consumer needs the same filter** — the root cause (no explicit default) is still there.
2. `npx tsx` does not auto-load `.env`, and esbuild/tsx **hoists static `import` statements above inline code** — so a `dotenv.config()` call placed *after* an `import` in source still executes after that import's module (and anything it reads from `process.env` at load time, like `lib/prisma.ts`'s adapter URLs) has already run. Confirmed empirically: without a true preload (`-r dotenv/config`, or a dynamic `await import()` placed after `dotenv.config()`), Prisma's better-sqlite3 adapter silently opens the wrong file — `"file:./interlex.db"` resolves relative to `process.cwd()`, and an unset env var falls back to `lib/prisma.ts`'s default `"file:./prisma/interlex.db"`/`"file:./prisma/corpus.db"`, which are pre-existing 0-byte stray artifacts in this repo (harmless, safe to ignore or delete) rather than the real root-level databases. Any new `scripts/db/*.ts` that imports `@/lib/prisma` (directly or transitively) needs either `-r dotenv/config` on the CLI invocation or a dynamic `import()` positioned after `dotenv.config()` — a static import will not reliably work regardless of source-line order.
3. Prisma 7's client-engine-runtime appears to leak memory across many sequential `$transaction([...])` calls in one process (reproduced independent of the app's own code — bounding the JS-side batch buffer to 500 items first ruled out an application-level leak; the process still grew unboundedly and OOM'd at both 4GB and 8GB heap, just later). Not root-caused or reported upstream. Practical workaround used here: `generateCorpusCandidateProposals` accepts `clusterOffset`/`clusterLimit`, and `scripts/db/generate-corpus-candidate-proposals.ts [limit] [offset]` lets a full backfill be chunked across separate process invocations (~8,000 clusters/run was reliable; ~15,000+ occasionally wasn't) — each invocation is a fresh process, so memory doesn't carry over. Worth trying again on a future Prisma version before assuming this workaround is still needed.

### Key Files
- `prisma/corpus.schema.prisma` — `CorpusCandidateProposal` model, `CorpusToken.isPartialMatch`
- `scripts/db/2026-07-29-add-corpus-candidate-proposals.ts` — idempotent raw-SQL migration (table + column)
- `lib/corpus/candidates/reconstruct.ts` — reverse ending-index lookup, per-stem-class citation reconstruction
- `lib/corpus/candidates/generateProposals.ts` — clustering, upsert, `clusterOffset`/`clusterLimit` chunking
- `scripts/db/generate-corpus-candidate-proposals.ts` — CLI entry point, `[limit] [offset]`
- `app/admin/corpus-candidates/page.tsx` + `corpus-candidates-client.tsx` + `actions.ts` — review UI, approve/reject server actions
- `config/features.ts` — `Feature.CorpusCandidatesReview`