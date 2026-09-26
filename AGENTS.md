# Project Context: Interslavic Lexicon & Learning Platform (interlex)

> Историческая хроника инцидентов вынесена в `docs/history/` — читай её, когда нужен контекст "почему так", действующие правила ниже.

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
- **Semantic Relations:** All synonym/antonym/hypernym/etc. edges live in the single `semantic_relations` table (`SemanticRelation` model, `relationType` column). Reads and writes must go through the helpers in `lib/relations.ts` (`fetchSymmetricSemanticRelations`/`saveSymmetricSemanticRelation` for synonym/antonym/related/pos_synonym; `fetchOutgoingSemanticRelations`/`fetchIncomingSemanticRelations`/`saveDirectionalSemanticRelation` for the directional types) — never a hand-written `WHERE sourceId = ?` query, that is exactly the pattern that caused the original bidirectionality bug. Full history: `docs/history/2026-07-22-semantic-network.md`.
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

## Audit Logging (`data.schema.prisma` only)

One shared `AuditLog` table — one row per changed field, grouped by a common `actionId`. (It replaced an old per-table `actionHistory` JSON-blob column on 2026-07-25; the migration chronicle is in `docs/history/` if ever needed.)

- **Scope**: `data.schema.prisma` only. `library.schema.prisma`'s `LibraryEntry.actionHistory` intentionally still uses the old `lib/action-history.ts` (`buildEntry`/`append`) pattern — do not delete that file or migrate library.db as part of unrelated work. `auth.db`/`corpus.db` have no audit table at all yet; if one is needed there, build an equivalent separate table rather than trying to share `AuditLog` across databases (the four Prisma clients never join across DBs).
- **How to log a change**: `await logAudit(session?.user, entityType, entityId, changes)` where `changes` is `{ field, oldValue, newValue }[]`. `logAudit` filters out no-op changes (old === new after serialization) and no-ops entirely if `changes` is empty after filtering — you can pass every candidate field unconditionally and let it filter. Non-string values are `JSON.stringify`'d automatically.
- **Synchronous/raw-SQL contexts**: `app/admin/deduplication/actions.ts` uses `better-sqlite3` inside a synchronous `db.transaction(() => {...})` callback, which can't `await` — it inlines an equivalent raw `INSERT INTO audit_logs` (same shape, same `randomUUID()` actionId, same serialize-and-filter logic) inside the transaction instead of calling `logAudit`. Follow that pattern for any other synchronous-transaction call site.
- **entityType convention**: string tags like `"Lexeme"`, `"Morpheme"`, `"Candidate"` — matched to the model actually mutated, not always the one visible in the URL (e.g. editing a translation logs under `"Lexeme"` with fields like `${lang}.value`/`${lang}.veryfied`/`${lang}.message`, since translations belong to a Lexeme). Scripts log as `userEmail='script:<name>'`; the community consensus writer logs as `userEmail='community'`, `userId=NULL`.
- **UI**: `/admin/platform/audit-log` (`app/admin/platform/audit-log/page.tsx`) — server component, GET-query-string filters, paginated, gated by `requirePermission(session, Feature.LogsView)`.
- **Data migration note**: when replacing a legacy history/audit mechanism on a live table, don't assume the old data is worthless and drop it by default — check first. (The 2026-07-25 `actionHistory`→`AuditLog` migration dropped the old column outright only because active thesaurus editing hadn't started yet; the per-table write-site migration chronicle lives in git history / `docs/history` context if ever needed.)

### Key Files
- `lib/audit-log.ts` — `logAudit()` helper, `FieldChange` type
- `prisma/data.schema.prisma` — `AuditLog` model (`@@map("audit_logs")`)
- `scripts/db/2026-07-25-add-audit-log.ts` — deployment script (idempotent, safe to re-run)
- `app/admin/platform/audit-log/page.tsx` — read UI
- `lib/action-history.ts` — **still used**, but only by `library.schema.prisma` call sites — do not delete

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

3. **`matchByStemPrefix(clean, words)`**: Fallback when grammar engine generates wrong endings. Checks if surface form starts with `word.stem` (or `word.base`). Among candidates, prefers stems shorter than surface form (real word + ending) over stems equal to surface form. Selects longest matching stem.

### Flavor System (Regional Variants)
Words linked to multiple lexemes via `base_homonyms` table (JSON `wordIds` field) can specify regional flavor:
- `wordIds` stored as JSON array: `[123, 456]` (all CORE) or `[{id: 123, flavor: "CORE"}, {id: 456, flavor: "EAST"}]`
- `WordBaseRecord.flavor` passed through to `MorphoAnalysis.flavor` and to `EngineWordInput.flavor` in `matchForms`
- Currently verb/adj processors skip flavor (only CORE)

### validEndings Set
Populated from `ending_allophones` table (seeded by `scripts/db/seed-endings.ts`):
- Entries stored with `stemType`, `grammeme`, `value`, `flavorId`
- Current seed: 450 CORE endings covering noun stem types (o_hard, o_soft, a_hard, a_soft, u_basis, i_basis, consonant_n, consonant_s), adjective (adj_hard, adj_soft), and verb forms (present, aorist, imperfect, imperative, l-participle, active/passive participles), plus numeral/collective/adverb endings

### Standing conclusions (from the July 2026 grammar-engine consolidation)
- There is exactly **one noun declension engine**: `lib/grammar/declineNoun.ts` + `lib/grammar/stemClassifier.ts` + `lib/grammar/fourTonesGenerator.ts` (the old `lib/grammar/noun/index.ts` duplicate was deleted). Any noun-declension change touches only these files. History: `docs/history/2026-07-25-noun-declension-consolidation.md`.
- There is exactly **one verb conjugator**: `lib/grammar/verb/index.ts`, used by both the corpus engine (`processVerb`) and the word page (`Word.tsx`). History: `docs/history/2026-07-24-grammar-endings.md`.
- `lib/grammar/stress.ts::resolveStressOverride()` is the single entry point for per-lexeme/per-morpheme accent overrides — a new word class's generator must call it, or stress overrides silently fall back to hardcoded defaults.

---

## Standing Rules (extracted from history)

Short, still-binding rules distilled from the incident chronicle in `docs/history/`. Read the linked history file before changing anything in the area.

- **Semantic relations** (`docs/history/2026-07-22-semantic-network.md`): one table `semantic_relations`, all access via `lib/relations.ts` helpers (never raw `WHERE sourceId = ?`). The `source` column (`'manual'` vs `'ruwordnet_auto'`) protects moderator edits from reimports — any new auto-generated edge data needs the same scoping, and any bulk reimport must only delete its own `source` rows. Lexeme-merge code must rewire `semantic_relations` by *meaning* ids (`UPDATE OR IGNORE` + self-loop guard — see `app/admin/deduplication/actions.ts`) and comments via `rewireCommentsLexeme` (any merge script must do both).
- **Don't fabricate a linguistic fact** (`docs/history/2026-07-27-corpus-syntax-parser.md`, `2026-07-29-valency-preposition-links.md`, `2026-07-29-corpus-candidate-proposals.md`): `VerbGovernment`, valency preposition/case facts, and spelling-variant inventories are entered only by a moderator (or a linguist-verified import). Automated pipelines (candidate reconstruction, fuzzy RuWordNet matching) produce **hypotheses for review**, never auto-applied facts.
- **Tokenizer regexes** (`docs/history/2026-07-27-corpus-crawlers-collocations.md`): never reintroduce a hand-maintained character-class regex in the tokenizer — use Unicode property escapes (`\p{L}\p{M}\p{N}_`). Note: punctuation tokens still get no explicit `matchCount` (default `0`); any bulk query on `matchCount=0` must filter `wordIndex != -1` to exclude punctuation.
- **Paradigms** (`docs/history/2026-09-24-bots-core.md`, `2026-07-25-noun-declension-consolidation.md`): any surface that shows paradigms (word page, bots, future API) goes through `lib/paradigm.ts` — never calls the grammar engine directly. Paradigm copies drifted twice already.
- **Standard orthography & bots** (`docs/history/2026-09-24-hunspell.md`, `2026-09-24-bots-core.md`): standard-script conversions go through `lib/orthography/standard.ts` (not `lib/isv.ts`'s `isvToCyr`/`standardToSimple`); bots share the platform-neutral core in `lib/bots/core/*`.
- **Community** (`docs/history/2026-09-community-model.md`): public names only via `lib/community/identity.ts::resolvePublicNames` (never `User.name`/`User.email`/`AuditLog.userEmail` on public pages); volunteer consensus never writes `Translation.verified`; thresholds live only in `lib/community/consensus.ts`; per-user vote/comment rate limits are enforced in the routes, not `proxy.ts`; `settleVotes` must run before any value change.
- **DB scripts** (`docs/history/2026-07-29-corpus-candidate-proposals.md`, `2026-09-15-duplicate-service-lexemes.md`): a `scripts/db/*.ts` importing `@/lib/prisma` needs `-r dotenv/config` (tsx hoists imports above `dotenv.config()`); raw SQL on lexemes must set `Lexeme.updatedAt` explicitly; merge scripts must carry frequencies onto the target before reanalysis; never run a heavy `corpus.db` query while a reanalysis is writing; after a raw-SQL schema migration, restart the app process before touching the new column (the in-memory Prisma client doesn't see it).

---

## Production data changes (2026-09-24)

After the 2026-09-23 snapshot upload, **production is the source of truth** for `interlex.db`, `auth.db` and `library.db`: moderators, votes, comments and profiles accumulate there and exist nowhere else. They are changed by scripts through a registry, never by replacing the file (`release.sh --db=interlex|library` refuses without `--replace-source-of-truth`). The local databases are disposable copies.

**Workflow for a data change:**
1. `bash scripts/local/pull-prod.sh --db=interlex` — fresh copy of production (server-side `.backup`, never a raw copy of a live WAL file; `auth.db` is never pulled).
2. Write the script, add it to `scripts/db/manifest.ts` (`db`, `kind`, `dryRun`), run it locally: `npm run db:run -- scripts/db/<file>.ts` (dry run), then `--apply`.
3. Commit, push, `bash release.sh` (the server must be on that commit — `prod.sh` checks).
4. `bash prod.sh run scripts/db/<file>.ts` — dry run on production; read the output.
5. `bash prod.sh run scripts/db/<file>.ts --apply` — refused unless a successful dry run of the same file version exists from the last 24h; takes a backup `<db>.db.backup-before-run-<stamp>-<name>` first (5 kept per database); refused a second time unless `--again`. Long scripts: `--detach`, then `bash prod.sh log -f`.

**Registry**: `_applied_scripts` inside the database the script changes (`scripts/db/lib/registry.ts`) — one row per attempt (dry-run / apply / baseline), with checksum, commit, exit code, backup and log path (`logs/db-runs/`, gitignored). `npm run db:status` / `bash prod.sh status` list what is applied and flag a script whose file changed after it was applied; status is read-only. `mark-applied` records a script that was applied by other means.

**Manifest kinds**: `schema` — idempotent DDL, applied by `run.ts migrate` inside `rebuild-remote.sh` while the service is stopped (replaces the old hardcoded list; if it fails, the previous build is started again); `data` — one-off, run by hand only, must support dry run; `repeatable` — recomputations (frequency, contributor stats, proper-noun signals). Dated scripts before `LEGACY_CUTOFF` (2026-09-25) are history already applied on production and are not in the manifest; the runner refuses them.

**Data-script contract** (what the runner relies on): dry run by default — without `--apply` open the DB read-only or roll the transaction back; idempotent; read paths from `SQLITE_DB` / `AUTH_SQLITE_DB` / `CORPUS_SQLITE_DB` / `*_DATABASE_URL` (the runner sets all of them to absolute paths); write `audit_logs` rows as `userEmail='script:<name>'` for lexical changes; set `Lexeme.updatedAt` explicitly in raw SQL; no long write transactions on `corpus.db`; carry frequencies onto merge targets (traps in `docs/history/2026-09-15-duplicate-service-lexemes.md`).

**corpus.db is still rebuilt locally and uploaded as a file** — but moderators' corpus work on production survives: `release.sh --db=corpus` exports it (`scripts/db/corpus-export-manual.ts`: tokens with `resolutionSource='manual'`, `CorpusDependency.source='manual'`, proposals with `reviewedByEmail`) and applies it to the snapshot (`corpus-import-manual.ts`, stable keys: document + tokenIndex + surfaceForm, falling back to sentence text + occurrence number, since ids change on retokenization). Edits that find no place abort the release (`CORPUS_ALLOW_MISSING=1` to drop them knowingly); with the service stopped, `rebuild-remote.sh` re-counts the manual edits and refuses the swap if there are new ones. Rebuild the corpus against a fresh `pull-prod` of `interlex.db` (the corpus refers to lexeme slugs), and after the swap run `bash prod.sh run scripts/compute-lexicon-frequency.ts --apply`.

**Release gotchas, hit for real 2026-09-25**: `rebuild-remote.sh` stops/starts the service with `sudo systemctl` over a non-interactive ssh — without a passwordless-sudo drop-in on the server the release dies *after* `git pull`/`npm ci` but *before* the build, leaving the site running a stale `.next` build while looking deployed (`BUILD_ID` is the tell). The server has `/etc/sudoers.d/interslavic-release` (`admin ALL=(ALL) NOPASSWD: /bin/systemctl, /bin/chown, /bin/journalctl, /usr/bin/journalctl`, same pattern as the pre-existing `typikon`/`smart-garden-release` drop-ins) — recreate it if releases start failing at the `sudo` step. Also: `scp` of the ~5 GB snapshot can break at session close *after* the data has fully landed — `md5sum` both sides before re-uploading (rsync is not installed on the server), and with ~8 GB free use `--skip-backup` once a `corpus.db.backup-before-release-*` already exists from a recent attempt.

### Key Files
- `scripts/db/run.ts`, `scripts/db/manifest.ts`, `scripts/db/lib/registry.ts` (+ `registry.test.ts`)
- `prod.sh`, `scripts/ops/remote.sh` (ssh helpers shared with `release.sh`; sudoers drop-in noted above), `scripts/local/pull-prod.sh` (replaced `sync-data.sh`)
- `scripts/db/corpus-export-manual.ts`, `scripts/db/corpus-import-manual.ts` (+ `corpus-manual.test.ts`)
