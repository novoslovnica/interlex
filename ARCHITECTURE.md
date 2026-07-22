# Interslavic Lexicon - Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APP ROUTER APPLICATION                        │
│                              ( interslavic-lexicon.com )                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   PUBLIC ROUTES   │ │   ADMIN ROUTES    │ │   API ROUTES      │
        │                   │ │                   │ │                   │
        │ • /lexicon        │ │ • /admin          │ │ • /api/lexicon    │
        │ • /translate      │ │ • /admin/words    │ │ • /api/dict       │
        │ • /library        │ │ • /admin/synonyms │ │ • /api/words      │
        │ • /textbook/ru    │ │ • /admin/antonyms │ │ • /api/auth       │
        │ • /proto (ESSJa)  │ │ • /admin/relations│ │ • /api/roots      │
        │ • /corpus (KWIC)  │ │ • /admin/roots    │ │ • /api/endings    │
        │ • /transliteration│ │ • /admin/corpus.. │ │ • /api/corpus     │
        │ • /about          │ │ • /admin/dedup    │ │ • /api/proto      │
        │ • /settings       │ │ • /admin/platform │ │ • /api/word-      │
        │ • /profile        │ │                   │ │   relations       │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
        ┌───────────────────────────┐       ┌───────────────────────────┐
        │   AUTHENTICATION LAYER   │       │   FOUR-DATABASE SYSTEM    │
        │                           │       │                           │
        │ • NextAuth.js v5          │       │ • auth.db (SQLite)       │
        │ • Telegram Credentials    │       │   - Users, Sessions      │
        │   (HMAC-SHA256, ts-safe)  │       │   - FeaturePermission    │
        │ • Yandex OAuth2           │       │   - UserSettings         │
        │ • Google OAuth2           │       │                           │
        │ • RBAC (Role-Based)       │       │ • interlex.db (SQLite)   │
        │   - USER, MODERATOR, ADMIN│       │   - Lexemes, Meanings    │
        │ • Feature Permissions     │       │   - 18 language tables   │
        │   (per-route, ad hoc —    │       │   - Relations, Roots     │
        │   no central middleware)  │       │   - Proto-Slavic (ESSJa) │
        │ • Session Management      │       │                           │
        └───────────────────────────┘       │ • library.db (SQLite)    │
                    │                       │   - LibraryEntry (texts) │
                    │                       │                           │
                    │                       │ • corpus.db (SQLite)     │
                    │                       │   - Documents, Segments  │
                    │                       │   - Sentences, Tokens    │
                    └───────────────────────┴───────────────────────────┘
```

Each database has its own Prisma client (`prismaAuth`, `prismaData`, `prismaLibrary`, `prismaCorpus` in `lib/prisma.ts`), generated from separate schema files (`prisma/auth.schema.prisma`, `prisma/data.schema.prisma`, `prisma/library.schema.prisma`, `prisma/corpus.schema.prisma`). A query never spans two clients in one transaction — cross-database joins are done in application code.

## Core Features Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LEXICON (Лексикон)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   Search UI       │ │   Word Detail     │ │   API Endpoints   │
        │   (Home.tsx)      │ │   (/words/[id])   │ │   /api/lexicon    │
        │                   │ │                   │ │                   │
        │ • Search Input    │ │ • Word Display    │ │ • GET /api/lexicon│
        │ • Card Grid       │ │ • Meanings        │ │ • GET /api/lexicon│
        │ • Script Toggle   │ │ • Translations    │ │   /[id]/...       │
        └───────────────────┘ │ • Etymology       │ └───────────────────┘
                    │         │ • Relations       │
                    └─────────┴───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   DATA DATABASE   │
                    │   (interlex.db)   │
                    │                   │
                    │ • Word Model      │
                    │ • Meaning Model   │
                    │ • Language Tables │
                    │   (en, ru, uk...) │
                    └───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRANSLATOR (Перевод)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   Translation UI  │ │   Language Switch │ │   API Endpoints   │
        │   (Home.tsx)      │ │   Component       │ │   /api/dict       │
        │                   │ │                   │ │                   │
        │ • Source Lang     │ │ • 13+ Languages   │ │ • GET /api/dict   │
        │ • Target Lang     │ │ • Bidirectional   │ │   ?search=...     │
        │ • Swap Button     │ │ • Auto-detect     │ │   &from=...       │
        │ • Search Input    │ │   Browser Locale  │ │   &to=...         │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   EXTERNAL LINKS  │
                    │                   │
                    │ • Толковые словари│
                    │ • Authoritative   │
                    │   Dictionaries    │
                    └───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         LIBRARY (Библиотека)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   Text Collection │ │   Parallel Texts  │ │   Literature      │
        │   (page.tsx)      │ │                   │ │                   │
        │                   │ │                   │ │                   │
        │ • Interslavic     │ │ • Side-by-side    │ │ • Original Works  │
        │   Texts           │ │   Reading         │ │ • Translations    │
        │ • Curated Content │ │ • Multilingual    │ │ • Literary Pieces │
        └───────────────────┘ └───────────────────┘ └───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         TEXTBOOK (Учебник)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   Grammar Lessons │ │   Structured     │ │   Language-Specific│
        │   (/textbook/ru)  │ │   Modules        │ │   Content         │
        │                   │ │                   │ │                   │
        │ • Educational     │ │ • Step-by-step    │ │ • Russian-focused │
        │   Content         │ │   Learning       │ │   Grammar         │
        │ • Grammar Rules   │ │ • Exercises       │ │ • Lessons         │
        └───────────────────┘ └───────────────────┘ └───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                   PROTO-SLAVIC DICTIONARY / ESSJa (/proto)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   Search UI       │ │   Word Detail     │ │   API Endpoints   │
        │   (/proto)        │ │   (/proto/[id],   │ │   /api/proto      │
        │                   │ │   /proto/word/    │ │                   │
        │ • Etymology Search│ │   [slug])         │ │                   │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   ProtoSlavicWord │
                    │   (interlex.db)   │
                    └───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CORPUS / KWIC SEARCH (/corpus)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   KWIC Search UI  │ │   Tokenizer       │ │   API Endpoints   │
        │   (/corpus)       │ │   (DbAnalyzer +   │ │   /api/corpus/    │
        │                   │ │   Tokenizer, see  │ │   analyze, /save  │
        │ • CQL-style query │ │   lib/corpus/)    │ │                   │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   CORPUS DATABASE │
                    │   (corpus.db)     │
                    │ • Document/Segment│
                    │ • Sentence/Token  │
                    └───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRANSLITERATION (/transliteration)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                    ┌───────────────────────────────────┐
                    │ Client-side Latin ⇄ Cyrillic ⇄ IPA │
                    │ conversion (lib/transliteration.ts)│
                    └───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         TEXTBOOK (Учебник)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │   Grammar Lessons │ │   Structured     │ │   Language-Specific│
        │   (/textbook/ru)  │ │   Modules        │ │   Content         │
        │                   │ │                   │ │                   │
        │ • Educational     │ │ • Step-by-step    │ │ • Russian-focused │
        │   Content         │ │   Learning       │ │   Grammar         │
        │ • Grammar Rules   │ │ • Exercises       │ │ • Lessons         │
        └───────────────────┘ └───────────────────┘ └───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD (/admin)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│   WORD MANAGEMENT │       │   RELATIONS       │       │   USER & SYSTEM  │
│                   │       │                   │       │                   │
│ • /admin/words    │       │ • /admin/synonyms │       │ • /admin/users    │
│ • CRUD Operations │       │ • /admin/antonyms │       │ • Role Management │
│ • Edit Fields     │       │ • /admin/relations│       │ • /admin/platform │
│ • Create/Delete   │       │   /[type] (9 more │       │   /users          │
│ • /admin/deduplic.│       │   relation types) │       │ • Permissions     │
└───────────────────┘       └───────────────────┘       └───────────────────┘
        │                               │                               │
        │       ┌───────────────────┐       ┌───────────────────┐
        │       │  MORPHOLOGY DATA  │       │  CORPUS BUILDER   │
        │       │                   │       │                   │
        │       │ • /admin/roots    │       │ • /admin/corpus-  │
        │       │ • /admin/endings  │       │   builder         │
        │       └───────────────────┘       │ • /admin/corpus/  │
        │                                   │   import, /builder│
        │                                   │   /documents      │
        │                                   └───────────────────┘
        └───────────────────────────────┼───────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────┐
                        │   RBAC PERMISSION SYSTEM  │
                        │                           │
                        │ • FeaturePermission Model  │
                        │ • Granular Access Control  │
                        │   (checked per-route, not │
                        │   via central middleware) │
                        │ • Moderator Capabilities  │
                        │ • Super-admin Overrides    │
                        └───────────────────────────┘
```

## Database Schema Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AUTH DATABASE (auth.db)                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│      User        │────────▶│     Account      │         │     Session      │
│                  │  1:N    │                  │         │                  │
│ • id (cuid)      │         │ • provider       │         │ • sessionToken  │
│ • name, email    │         │   (telegram/     │         │ • expires       │
│ • role           │         │   yandex/google) │         │ • userId        │
│   (USER/MOD/ADMIN)│       │ • access_token   │         └──────────────────┘
│ • image          │         │ • refresh_token  │
└──────────────────┘         └──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐         ┌──────────────────┐        ┌──────────────────┐
│ FeaturePermission│         │  UserSettings    │        │UserWordCollection│
│                  │         │                  │        │                  │
│ • userId         │         │ • userId         │        │ • userId         │
│ • featureKey     │         │ • script         │        │ • lexemeId       │
│   (~60 granular   │         │   (CYRILLIC/LATIN)│      │ (saved words)    │
│   Feature keys,   │         │ • theme, locale  │        └──────────────────┘
│   see config/     │         └──────────────────┘
│   features.ts)    │
└──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA DATABASE (interlex.db)                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│     Lexeme       │────────▶│     Meaning      │────────▶│  Language Tables │
│  (@@map lexemes) │  1:N    │                  │  1:N    │  (18 models: En, │
│ • id, slug       │         │ • id, lexemeId   │         │  Ru, Mk, Sr, Uk, │
│ • value, stem    │         │ • meaning        │         │  Bg, Pl, Be, Cs, │
│ • pos, gender    │         │ • examples       │         │  Sk, Sl, Hr, Hsb,│
│ • declension /   │         └──────────────────┘         │  Dsb, Cu, De, Nl,│
│   conjugation    │                                       │  Eo)             │
│ • paradigm,      │         ┌──────────────────┐         │ each: id, value, │
│   protoStemClass │         │    Morpheme      │         │ veryfied, wordId,│
│ • corpusFrequency,│        │  (root, @@map    │         │ meaningId — NO   │
│   corpusRank,     │        │   morphemes)      │        │ @@index on FKs   │
│   corpusHapax     │        │ • id, value      │         └──────────────────┘
│ • cefrLevel,      │        └──────────────────┘
│   distributionD,           │
│   usageScore      │        │ 1:N (LexemeMorpheme)
│  (frequency/CEFR   │        ▼
│   already shipped, │  ┌──────────────────┐
│   NOT a future TODO)│  │ LexemeMorpheme  │
└──────────────────┘        │ • lexemeId       │
         │                  │ • morphemeId     │
         │ 1:N               └──────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Synonym / Antonym / Hypernym / Hyponym / Meronym / Holonym /        │
│  RelatedWord / Cause / Effect / Premise / Conclusion (11 tables)     │
│                                                                        │
│  Each: id, sourceId → Meaning, targetId → Meaning, proximity          │
│  onDelete: Cascade on both FKs (DB-level cascade delete exists).      │
│  ⚠ Writes are one-directional (sourceId→targetId only) — linking      │
│    A→B does NOT create a reverse B→A row. See "Known Issues" below.   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ AllophoneFlavor  │  │ LexemeAllophone  │  │ EndingAllophone  │
│ (CORE/NSL/EAST/  │  │ • lexemeId       │  │ • stemType,      │
│  WEST/SOUTH)     │  │ • flavorId       │  │   grammeme, value│
└──────────────────┘  │ • value, type    │  │ • flavorId       │
                       └──────────────────┘  │ (seeded FROM the │
                                              │  same hardcoded  │
                                              │  registries — see│
                                              │  AGENTS.md)       │
                                              └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ BaseHomonym      │  │InflectionAnomaly │  │ ProtoSlavicWord  │
│ (stem→lexemeIds  │  │ • lexemeId       │  │ (ESSJa etymology │
│  map for corpus  │  │ • inflection,    │  │  dictionary, /proto│
│  tokenizer)      │  │   grammeme        │  │  feature)        │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐
│    Synset        │  │  MeaningSynset   │
│ (RuWordNet-derived│─▶│ • meaningId      │
│  synset groups)   │  │ • synsetId       │
└──────────────────┘  └──────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  AuditLog (@@map audit_logs)                                          │
│  • actionId (groups fields changed in one save into one action)      │
│  • entityType ('Lexeme' | 'Morpheme' | 'Candidate' | ...), entityId  │
│  • field, oldValue, newValue (all stored as strings; non-string      │
│    values are JSON.stringify'd by lib/audit-log.ts)                  │
│  • userId (nullable, no FK — auth.db is a separate database),        │
│    userEmail (snapshot, always present)                              │
│  Replaces the old per-row `actionHistory` JSON-blob column, which     │
│  was removed from all 21 data.schema.prisma models. UI: see          │
│  /admin/platform/audit-log, gated by Feature.LogsView.                │
│  ⚠ Scoped to data.schema.prisma only — auth.db and corpus.db have no  │
│    equivalent yet; library.schema.prisma's LibraryEntry.actionHistory │
│    intentionally still uses the OLD lib/action-history.ts pattern.    │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    LIBRARY DATABASE (library.db)                            │
└─────────────────────────────────────────────────────────────────────────────┘
┌──────────────────┐
│  LibraryEntry    │   Texts/parallel readings for /library, managed via
│ • title, slug    │   /admin/library and /admin/platform/library
│ • content, cover │   • actionHistory: still the OLD JSON-blob pattern
│                  │     (lib/action-history.ts) — NOT migrated to AuditLog,
│                  │     see Database Schema Architecture notes above.
└──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CORPUS DATABASE (corpus.db)                              │
└─────────────────────────────────────────────────────────────────────────────┘
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ CorpusDocument   │──▶│ CorpusSegment    │──▶│ CorpusSentence   │
│                  │1:N│                  │1:N│                  │
└──────────────────┘   └──────────────────┘   └────────┬─────────┘
                                                          │ 1:N
                                                          ▼
                                               ┌──────────────────┐
                                               │  CorpusToken     │
                                               │ • lemma, pos     │
                                               │ • feats (JSON)   │
                                               │ • matchCount      │
                                               └──────────────────┘
Plus WordFormPriority and CorpusConfig for tokenizer tuning.
```

## Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

USER ATTEMPTS LOGIN
         │
         ▼
┌──────────────────┐
│  Login Options   │
│                  │
│ • Telegram (Credentials provider)│
│ • Yandex OAuth2  │
│ • Google OAuth2  │
└──────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────┐
│                    PROVIDER VALIDATION (auth.config.ts)               │
│                                                                     │
│  TELEGRAM (Credentials, not real OAuth):                            │
│  • verifyTelegramAuth() - HMAC-SHA256, crypto.timingSafeEqual        │
│    (constant-time compare — fixed 2026-07-22, was `===`)            │
│  • Check auth_date (24-hour expiry) — no nonce/replay-store yet,     │
│    a captured valid payload is still replayable within that window  │
│  • Extract user data (id, name, photo_url, username)                │
│                                                                     │
│  YANDEX / GOOGLE:                                                    │
│  • Standard OAuth2 flow via @auth/core providers                    │
└───────────────────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────┐
│                    SESSION CREATION                                 │
│                                                                     │
│  • Check if user exists in auth.db                                 │
│  • If not: create new User record                                  │
│  • Generate JWT session token                                       │
│  • Store in Session table                                           │
│  • Return session with user.id and user.role                       │
└───────────────────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────┐
│                    ROLE-BASED ACCESS CONTROL                        │
│                                                                     │
│  ROLES:                                                             │
│  • USER - Default, read-only access                                │
│  • MODERATOR - Limited admin access based on FeaturePermission      │
│  • ADMIN - Full system access                                      │
│                                                                     │
│  FEATURE PERMISSIONS (~60 granular keys, config/features.ts):        │
│  • words_create/edit/delete/nsl_edit                                │
│  • synonyms_edit, antonyms_edit, relations_manage                   │
│  • hypernyms/hyponyms/meronyms/holonyms/related_words/causes/       │
│    effects/premises/conclusions_edit (per-relation-type)             │
│  • roots_*, endings_*, candidates_*, deduplication_manage           │
│  • library_manage, corpus_builder                                    │
│  • translate_<lang> — one per translation language                  │
└───────────────────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────┐
│                    ROUTE PROTECTION                                 │
│                                                                     │
│  lib/permissions.ts: requireRole/requirePermission (redirect-based, │
│  for Server Components) and checkPermission (boolean, for API       │
│  routes/Server Actions). ADMIN always passes; MODERATOR needs a     │
│  matching FeaturePermission row; USER is always denied.              │
│                                                                     │
│  ⚠ There is no middleware.ts / central route guard — every          │
│  app/admin/**/page.tsx and app/api/**/route.ts calls auth() +       │
│  checkPermission()/requirePermission() by hand. This is done        │
│  consistently in most routes, but the repetition is exactly what    │
│  let a route slip through unchecked in the past (see Known Issues). │
└───────────────────────────────────────────────────────────────────┘
```

## API Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ROUTE STRUCTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

/api/lexicon
├── GET /api/lexicon
│   └── Search lexicon with pagination (getDictItems in services.ts)
│       Parameters: search, limit, offset, mainCategory, usageType
│       Search uses parameterized LIKE against lexemes_text/
│       lexeme_allophones_text (fixed 2026-07-22 — was string-
│       interpolated into SQL; still not true FTS5 MATCH, see
│       Known Issues)
├── GET /api/lexicon/[id]/root, /by-slug/[slug]
└── POST /api/lexicon/[id]/updateField

/api/word-relations/save          -- POST, gated per relation `type`
    on the matching Feature (SynonymsEdit/AntonymsEdit/HypernymsEdit/
    .../ConclusionsEdit) or RelationsManage (fixed 2026-07-22 — was
    session-only, no permission check)

/api/synonyms/second-level        -- POST, requires session (fixed
    2026-07-22 — was unauthenticated)

/api/corpus
├── POST /api/corpus/analyze      -- tokenize+tag raw text via
│   DbAnalyzer, requires Feature.CorpusBuilder (fixed 2026-07-22 —
│   was unauthenticated)
└── POST /api/corpus/save         -- persist analyzed segments,
    requires Feature.CorpusBuilder (already gated)

/api/proto
└── GET /api/proto                -- ESSJa proto-Slavic search

/api/roots, /api/roots/[id], /api/roots/[id]/words(/search),
/api/roots/create                 -- Feature.RootsEdit/RootsCreate/
    RootsDelete per route

/api/endings, /api/endings/[id]   -- Feature.EndingsEdit/Create/Delete

/api/candidates                   -- word candidate promotion/rejection

/api/library/search, /api/library/[slug]/download

/api/admin/corpus/documents/[slug](/reanalyze|/segments/[position]|/tei)
/api/admin/library/upload
/api/admin/recompute-frequencies  -- recomputes Lexeme.corpusFrequency/
    corpusRank/cefrLevel (see scripts/compute-lexicon-frequency.ts)

/api/dict
└── GET /api/dict — translation lookup between languages

/api/words/search, /api/meanings/search, /api/translation-cards/random,
/api/profile/collection/check, /api/profile/words

/api/auth
└── NextAuth.js endpoints (/[...nextauth])
    ├── /api/auth/signin / signout / callback / session
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REACT COMPONENTS                                    │
└─────────────────────────────────────────────────────────────────────────────┘

HEADER COMPONENTS
├── HeaderNav (Client Component)
│   ├── Desktop: Horizontal flex row navigation
│   ├── Mobile: Hamburger menu with absolute positioning overlay
│   ├── LanguageSwitcher (Locale management)
│   └── Session-aware user controls
│
└── AdminNav (Admin dashboard navigation)

ADMIN COMPONENTS
├── Table (Infinite editable table)
│   ├── EditableCell (Field editing)
│   ├── EditableLanguageCell (Language-specific editing)
│   └── InfiniteEditableTable (Virtual scrolling)
│
├── ArticleForm (Content creation)
├── MergeModal (Word deduplication)
├── DubplicateGroup (Duplicate management)
└── TelegramLogin (Telegram auth widget)

SHARED COMPONENTS
├── DevStatusToast (Development status indicator)
└── LanguageSwitcher (i18n locale switcher)
```

## Technology Stack

```
FRONTEND
├── Next.js 16.2.9 (App Router)
├── React 19.2.4
├── TypeScript 5 (Strict mode, no any types)
├── Tailwind CSS 4
├── next-intl 4.13.0 (Internationalization)
└── @tanstack/react-query (Data fetching)

BACKEND / DATABASE
├── Prisma 7.8.0 (ORM)
├── SQLite (better-sqlite3 12.11.1)
├── @prisma/adapter-better-sqlite3
└── Dual database architecture
    ├── auth.db (Authentication & Authorization)
    └── interlex.db (Lexical data)

AUTHENTICATION
├── NextAuth.js 5.0.0-beta.31
├── @auth/prisma-adapter 2.11.2
├── Providers:
│   ├── Telegram (Custom Credentials provider)
│   └── Yandex (OAuth provider)
└── JWT session strategy

DEVELOPMENT
├── ESLint 9
├── TypeScript strict mode
├── Hot reload support
└── Environment-based configuration
    ├── .env.development
    ├── .env.production
    └── .env.release
```

## Data Flow Examples

### Lexicon Search Flow
```
User Input (Home.tsx)
    ↓
Script Conversion (standardToSimple, mapNslToEtymologized)
    ↓
API Call: GET /api/lexicon?search=...&limit=50&offset=0
    ↓
Service Layer (getDictItems, app/api/lexicon/services.ts)
    ↓
Raw better-sqlite3 query via lib/sqlite (NOT Prisma — parameterized
LIKE against lexemes_text / lexeme_allophones_text)
    ↓
Database (interlex.db)
    ↓
Response: Lexeme[] with meanings and translations
    ↓
UI Update (Card Grid)
```

### Translation Flow
```
User Selects Languages (Home.tsx)
    ↓
User Input (Search term)
    ↓
API Call: GET /api/dict?search=...&from=ru&to=is
    ↓
Service Layer (getDictItems)
    ↓
Cross-Language Query (JOIN language tables)
    ↓
Database (interlex.db)
    ↓
Response: Translated pairs with external dictionary links
    ↓
UI Update (Translation cards)
```

### Admin Word Edit Flow
```
Admin User (Session verified)
    ↓
Navigate to /admin/words/[id]
    ↓
Load Word Data (GET /api/lexicon/[id])
    ↓
Edit Field (EditableCell)
    ↓
API Call: POST /api/lexicon/[id]/updateField
    ↓
Permission Check (checkPermission/requirePermission, FeaturePermission)
    ↓
Prisma Update (prismaData.lexeme.update)
    ↓
Database (interlex.db)
    ↓
UI Update (Table refresh)
```

## Key Design Patterns

1. **Four-Database Architecture**: Separation of auth.db (authentication), interlex.db (lexical data), library.db (texts), and corpus.db (tokenized corpus) — each with its own Prisma client and generated schema, never joined cross-database in a single query

2. **Role-Based Access Control (RBAC)**: Granular permission system with USER/MODERATOR/ADMIN roles and ~60 feature-specific permission keys, checked per-route (no central middleware — see Authentication section)

3. **Relations are symmetric, stored as one undirected edge per pair** (fixed 2026-07-22): Synonym/Antonym/Hypernym/.../Conclusion tables store `sourceId`/`targetId` as storage detail only — `lib/relations.ts` (`fetchSymmetricRelations`/`saveSymmetricRelation`) treats them as unordered everywhere. Reads match `sourceId = ? OR targetId = ?` and resolve "the other side" in JS; writes diff the target list against existing edges (found via the same OR match) and add/remove exactly the edges that changed, storing each pair once regardless of which column ends up holding which id. This means legacy one-directional rows from historical bulk imports (~41% of the `synonyms` table before the fix) are automatically picked up correctly on read with no backfill needed, and editing from either endpoint (word A's page or word B's page) correctly finds and removes the same edge. Previously, write paths only inserted the forward `sourceId → targetId` row and reads only matched `sourceId`, so linking A→B did not make B show A back — see the git history / prior audit note for the original bug description.

4. **Language-Agnostic Schema**: 18 per-language Prisma models (En, Ru, Mk, Sr, Uk, Bg, Pl, Be, Cs, Sk, Sl, Hr, Hsb, Dsb, Cu, De, Nl, Eo) with identical structure for easy extension; none currently have `@@index` on their `wordId`/`meaningId` foreign keys

5. **Server-Side Rendering**: Next.js App Router with server components for optimal performance and SEO

6. **Client-Side Interactivity**: 'use client' components for dynamic features (search, editing, navigation)

7. **Internationalization**: next-intl for multi-language support with locale-aware routing

8. **Mobile-First Navigation**: Responsive HeaderNav with hamburger menu and absolute positioning overlay

9. **Virtual Scrolling**: TanStack Virtual for efficient handling of large datasets in admin tables

10. **Grammar Engine (lib/grammar/)**: Generates full paradigms (noun/adjective/pronoun/numeral declension, verb conjugation) from ending registries that currently encode etymological Proto-Slavic forms rather than modern Interslavic ones — see "Known Issues" below and the detailed writeup in AGENTS.md

11. **Type Safety**: Strict TypeScript with explicit interfaces, avoiding 'any' types (aspirational — see "Widespread `any` usage" in Known Issues below)

12. **Shared AuditLog table for data.schema.prisma** (added 2026-07-25): all lexical-data write sites (`lib/actions/word-actions.ts`, `app/api/lexicon/[id]/updateField/service.ts`, `app/api/roots/*/route.ts`, `app/admin/synonyms|antonyms|relations/[type]|candidates|deduplication/*`) call `logAudit(user, entityType, entityId, changes)` from `lib/audit-log.ts`, which writes one row per changed field into a single shared `AuditLog` table instead of the old per-table `actionHistory` JSON blob. This replaced `actionHistory` on all 21 data.schema.prisma models (the column was dropped, existing history was not preserved — active thesaurus editing hadn't started yet, so there was nothing worth migrating). Scoped intentionally to `data.schema.prisma` only: `library.schema.prisma`'s `LibraryEntry.actionHistory` still uses the old `lib/action-history.ts` (`buildEntry`/`append`) pattern, and `auth.db`/`corpus.db` have no audit table at all yet. Minimal read UI at `/admin/platform/audit-log`, gated by the previously-unused `Feature.LogsView` permission.

## Known Issues & Technical Debt

A security/architecture audit on 2026-07-22 found the following; items marked ✅ were fixed the same day, the rest are open:

- ✅ **SQL injection** in lexicon search (`app/api/lexicon/services.ts`) — user input was string-interpolated into a `LIKE` clause. Fixed with parameterized queries.
- ✅ **Missing permission check** on `POST /api/word-relations/save` — any authenticated user could rewrite any relation table regardless of role. Fixed by mapping each relation `type` to its `Feature` key.
- ✅ **Unauthenticated endpoints** `POST /api/synonyms/second-level` and `POST /api/corpus/analyze` — now require a session (and `Feature.CorpusBuilder` for the latter).
- ✅ **Non-constant-time HMAC comparison** in Telegram auth (`auth.config.ts`) — replaced `===` with `crypto.timingSafeEqual`.
- ✅ **Relations were not bidirectional** (fixed 2026-07-22, see Key Design Pattern #3 above) — all read/write paths for the 11 relation tables (`app/api/word-relations/save/route.ts`, `app/admin/relations/[type]/page.tsx`, `app/admin/synonyms/page.tsx`, `app/admin/antonyms/page.tsx`, `app/admin/words/[id]/edit/page.tsx`, `app/words/[id]/api.ts`, `app/api/synonyms/second-level/route.ts`) now go through the shared `lib/relations.ts` helpers instead of one-off `sourceId`-only queries.
- ✅ **Grammar engine produced Proto-Slavic, not modern Interslavic, endings** (fixed 2026-07-24 for nouns/adjectives/numerals-three-four; see AGENTS.md's "RESOLVED: Grammar Engine Was Producing Wrong Endings" for the full writeup). Turned out the live `ending_allophones` DB table had already been manually corrected via `/admin/endings` over time — `getEnding()` in `lib/grammar/endingLoader.ts` really does consult it before falling back to the hardcoded registry, so the *site* was mostly fine; it was the **hardcoded registries** (`endingsRegistry.ts`, `adjective/index.ts`) and `scripts/db/seed-endings.ts` that were stale, meaning a fresh DB or a DB-unavailable fallback would still hit the bug. Extracted the corrected values from the DB into the registries and fixed the seed script to match, so it's now safe to re-run. Also fixed a separate, related issue: the nasal vowel has two spellings in this codebase (`ǫ` Proto-Slavic-style vs `ų` modern) — migrated every modern-ISV-generation code path to `ų` (confirmed correct with the maintainer), leaving `lib/proto.ts`'s genuine Proto-Slavic input side untouched. Along the way, found and deleted two fully-dead duplicate registries (`noun/index.ts`'s unused `SLAVIC_ENDINGS_REGISTRY` export, and the entire orphaned `adjective/adjective.ts` file). `lib/grammar/verb/index.ts` and `lib/grammar/verb/conjugator2.ts` turned out to be two independently-live verb conjugators (engine path vs. `Word.tsx`'s word-detail-page path) that had drifted — `conjugator2.ts` silently ignored `tertiaryStem`, giving wrong l-participles for verbs like "byti"/"dojdti" — so on 2026-07-25 they were consolidated onto `verb/index.ts` alone; `conjugator2.ts`, the already-dead `conjugator.ts`, and their now-orphaned helpers (`auxiliary.ts`, `types/conjugator.ts`, `addToneSyllable.ts`) were deleted. See AGENTS.md for the full writeup. Verb present/aorist/imperfect/imperative and `numeral_two`/`collective_*` endings were checked and found to already look correct (no jers) — not linguist-verified, just nothing obviously wrong. `morphology.test.ts`/`declineNoun.test.ts` still aren't wired to a real runner (see below) — the one assertion directly tied to this fix was corrected; the other 9 failures in `morphology.test.ts` are a separate, pre-existing bug in the four-tones accent engine, confirmed unrelated (same failures reproduce against the pre-fix DB backup).
- ⬜ **No working automated tests** — the `*.test.ts` files under `lib/` have no test runner wired up (no vitest/jest, no `test` script) and use manual `console.log` assertions instead of `expect()`. Some of them assert the Proto-Slavic forms as "correct," so wiring up a runner as-is would certify the bug above as intended behavior.
- ✅ **FTS5 table unused as FTS** (fixed 2026-07-22) — `lexemes_text`/`lexeme_allophones_text` were queried with `LIKE '%term%'`, which can't use an FTS5 index. Both virtual tables were rebuilt with `tokenize='trigram'` (verified byte-for-byte identical result sets vs. the old `LIKE` scan across Latin/Cyrillic/short-query samples) and `getDictItems` now uses `MATCH` for search terms of 3+ characters, falling back to parameterized `LIKE` below that (trigram tokenization can't index patterns shorter than 3 chars). **Deployment note:** apply this with `npx tsx scripts/db/2026-07-22-add-indexes-and-fts5-trigram.ts`, not the sibling `.sql` file run through the system `sqlite3` CLI — on the production host, that CLI's SQLite build lacked the trigram tokenizer even though the app's own `better-sqlite3` dependency has it, and running the raw SQL dropped `lexemes_text`/`lexeme_allophones_text` before failing to recreate them, breaking lexicon search until `scripts/db/2026-07-22-emergency-restore-fts5.sql` was run. The `.ts` script probes for trigram support before touching anything, so it can't fail this way.
- ✅ **Missing indexes** (fixed 2026-07-22) — added `@@index` on `Lexeme.value`, `Meaning.lexemeId`, `sourceId`/`targetId` on all 11 relation tables, and `wordId`/`meaningId` on all 18 language tables (60 indexes total, applied directly via SQL — see the Prisma migration-drift note above for why `prisma migrate` wasn't used).
- ⬜ **N+1 queries on `/words/[id]`** — `app/words/[id]/api.ts` issues one query per language table (not batched) and `getItem()` runs twice per page load (`generateMetadata` + the page itself) with no `React.cache`.
- ⬜ **Widespread `any` usage** despite the project's "avoid `any`" rule (100+ occurrences across `app/`/`lib/`).
- ⚠️ **Prisma migration history has drifted from the live `interlex.db`** (discovered 2026-07-22 while adding the indexes below): `prisma migrate dev` reports unrecorded schema changes on `morpheme_allophones` and `proto_slavic_words` that predate this audit and aren't in any migration file. Running `prisma migrate dev` against this database will prompt for a full reset (data loss) — do **not** run it until the drift is reconciled (e.g. via `prisma migrate diff` + a manual baseline migration). New DDL was applied in the meantime via direct SQL against `interlex.db`, bypassing `prisma migrate`.
