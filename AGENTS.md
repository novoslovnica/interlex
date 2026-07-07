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

### Future Roadmap & Upcoming Features (Keep in Mind During Dev)
- **Data Visualization Graphs:** Engineering interactive UI elements such as **synonym clouds** and relational connection graphs to visually map semantic and structural word proximity.
- **Semantic & Structural Similarity:** Introduction of vector embeddings or algorithmic scoring to determine similarity weights between words.
- **Word Frequency (Частотность):** Integration of usage frequency metrics (corpus frequency counts from the library texts) to rank search results and prioritize learning modules.

---

## Tech Stack & Code Quality
- **Framework:** Next.js 16 (App Router architecture).
- **Language:** TypeScript 5 (strict mode). **Strict Rule:** Avoid `any` type completely. Use explicit interfaces or models (e.g., `Session | null` from `next-auth`).
- **Authentication & Security:** NextAuth.js v5 (beta). Telegram (Credentials provider with HMAC-SHA256) + Yandex OAuth2 providers. Protect all `/admin` routes, API endpoints, and Server Actions with session verification checking specific user permission flags (RBAC).
- **Database:** Dual SQLite databases — `auth.db` (authentication: User, Session, FeaturePermission, UserSettings) and `interlex.db` (lexical data: Lexeme, Meaning, Morpheme, relations, 16 language tables). Prisma 7 ORM with separate generated clients.
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
- **Bidirectional Relations:** When creating or modifying lexemes in the Admin UI, updates to relations (Synonyms, Antonyms, Cognates) must maintain relational integrity in the database (e.g., linking Word A as a synonym to Word B should reflect bidirectionally if the schema requires it).
- **Extensible Schema:** Keep data structures flexible to easily accommodate future frequency indexes, data arrays for etymology, dictionary URLs, and node/edge weights for visualization graphs.
- **Script-Aware Rendering:** All word displays must support Cyrillic/Latin toggling via ISV conversion functions.

### 3. Server/Client Component Architecture
- **Pages** are server components that fetch session data; interactive features use `"use client"` components.
- **Dual Database Access:** Auth queries use the `auth` Prisma client; lexical queries use the `data` Prisma client. Never cross database boundaries in a single query.

---

## AI Agent Development Principles
- **Prevent UI Regressions:** Always double-check that mobile dropdown/hamburger updates do not break desktop alignments, and vice-versa.
- **Maintain High Density:** Keep code scannable, structural styles semantic, and avoid redundant CSS overrides.
- **Grammar Engine Awareness:** The project includes a sophisticated grammar engine (`lib/grammar/`) handling verb conjugation, noun/adjective/pronoun/numeral declension, adverb comparison, stem classification, morphonology, accent/tone generation, and enclitic processing. Changes to word display or admin editing must respect these grammatical structures.