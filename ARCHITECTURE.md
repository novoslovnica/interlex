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
        │ • /about          │ │ • /admin/users    │ │ • /api/roots      │
        │ • /settings       │ │ • /admin/dedup    │ │                   │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
        ┌───────────────────────────┐       ┌───────────────────────────┐
        │   AUTHENTICATION LAYER   │       │   DUAL DATABASE SYSTEM    │
        │                           │       │                           │
        │ • NextAuth.js v5          │       │ • auth.db (SQLite)       │
        │ • Telegram OAuth          │       │   - Users, Sessions      │
        │ • Yandex OAuth            │       │   - Permissions          │
        │ • RBAC (Role-Based)       │       │   - Settings             │
        │   - USER, MODERATOR, ADMIN│       │                           │
        │ • Feature Permissions     │       │ • interlex.db (SQLite)   │
        │ • Session Management      │       │   - Words, Meanings      │
        └───────────────────────────┘       │   - Language Tables      │
                    │                       │   - Relations           │
                    │                       │   - Roots               │
                    └───────────────────────┴───────────────────────────┘
```

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
│ • Edit Fields     │       │ • Word Families   │       │ • Permissions     │
│ • Create/Delete   │       │ • Cognates        │       │ • Deduplication   │
└───────────────────┘       └───────────────────┘       └───────────────────┘
        │                               │                               │
        └───────────────────────────────┼───────────────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────┐
                        │   RBAC PERMISSION SYSTEM  │
                        │                           │
                        │ • FeaturePermission Model  │
                        │ • Granular Access Control  │
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
│ • name           │         │ • providerAccountId│       │ • expires       │
│ • email          │         │ • access_token   │         │ • userId        │
│ • role           │         │ • refresh_token  │         └──────────────────┘
│   (USER/MOD/ADMIN)│       └──────────────────┘
│ • image          │
└──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐         ┌──────────────────┐
│ FeaturePermission│         │  UserSettings    │
│                  │         │                  │
│ • userId         │         │ • userId         │
│ • featureKey     │         │ • script         │
│   (dictionary_create)    │   (CYRILLIC/LATIN)│
│   (users_delete)  │         │ • updatedAt      │
└──────────────────┘         └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA DATABASE (interlex.db)                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│      Word        │────────▶│     Meaning      │────────▶│  Language Tables │
│                  │  1:N    │                  │  1:N    │  (en, ru, uk...) │
│ • id             │         │ • id             │         │                  │
│ • value          │         │ • wordId         │         │ • value         │
│ • nsl            │         │ • meaning        │         │ • veryfied      │
│ • isv            │         │ • examples       │         │ • wordId        │
│ • transcription  │         └──────────────────┘         │ • meaningId     │
│ • field          │                                       │                 │
│ • declension     │                                       └──────────────────┘
│ • etymology      │
│ • genesis        │         ┌──────────────────┐
│ • type           │         │      Root        │
│ • pos            │         │                  │
│ • frequency      │         │ • id             │
│ • proto          │         │ • value          │
│ • paradigm       │         │ • type           │
│ • protoStemClass │         └──────────────────┘
│ • stemExtension  │                  │
└──────────────────┘                  │ 1:N
         │                            ▼
         │ 1:N              ┌──────────────────┐
         │                  │    RootWord      │
         ▼                  │                  │
┌──────────────────┐         │ • wordId         │
│    Synonym       │         │ • rootId         │
│                  │         └──────────────────┘
│ • rootId         │
│ • wordId         │         ┌──────────────────┐
│ • proximity      │         │    Antonym       │
└──────────────────┘         │                  │
         │                  │ • rootId         │
         │                  │ • wordId         │
         │                  │ • proximity      │
         │                  └──────────────────┘
         │
         ▼
┌──────────────────┐
│    Antonym       │
│                  │
│ • rootId         │
│ • wordId         │
│ • proximity      │
└──────────────────┘

LANGUAGE TABLES (17 languages):
en, ru, mk, sr, uk, bg, pl, be, cs, sk, sl, hr, cu, de, nl, eo
Each table: id, value, veryfied, wordId, meaningId
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
│ • Telegram OAuth │
│ • Yandex OAuth   │
└──────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────┐
│                    OAUTH PROVIDER VALIDATION                          │
│                                                                     │
│  TELEGRAM:                                                          │
│  • verifyTelegramAuth() - HMAC-SHA256 validation                  │
│  • Check auth_date (24-hour expiry)                                │
│  • Extract user data (id, name, photo_url, username)                │
│                                                                     │
│  YANDEX:                                                            │
│  • Standard OAuth2 flow                                             │
│  • Provider: @auth/core/providers/yandex                            │
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
│  FEATURE PERMISSIONS (for Moderators):                             │
│  • dictionary_create, dictionary_delete                           │
│  • users_view, users_manage                                        │
│  • translations_edit, texts_edit                                  │
│  • etc. (granular feature flags)                                   │
└───────────────────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────────────────────────────────────────────────────┐
│                    ROUTE PROTECTION                                 │
│                                                                     │
│  /admin/* routes:                                                   │
│  • Server-side session check (auth())                              │
│  • Role verification (ADMIN or MODERATOR)                           │
│  • Feature permission check for specific actions                   │
│  • Redirect to /login if unauthenticated                           │
└───────────────────────────────────────────────────────────────────┘
```

## API Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ROUTE STRUCTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

/api/lexicon
├── GET /api/lexicon
│   └── Search lexicon with pagination
│       Parameters: search, limit, offset
│       Returns: Word[] with meanings and translations
│
├── GET /api/lexicon/[id]
│   └── Get single word by ID with full details
│
├── POST /api/lexicon/[id]/root
│   └── Manage word-root relationships
│
└── POST /api/lexicon/[id]/updateField
    └── Update specific word field

/api/dict
└── GET /api/dict
    └── Translation between languages
        Parameters: search, from, to
        Returns: Translated word pairs with dictionary links

/api/words
└── GET /api/words
    └── Word search and lookup

/api/roots
└── GET /api/roots
    └── Root word management

/api/auth
└── NextAuth.js endpoints (/[...nextauth])
    ├── /api/auth/signin
    ├── /api/auth/signout
    ├── /api/auth/callback
    └── /api/auth/session
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
Service Layer (getDictItems)
    ↓
Prisma Query (prismaData.word.findMany)
    ↓
Database (interlex.db)
    ↓
Response: Word[] with meanings and translations
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
Permission Check (FeaturePermission)
    ↓
Prisma Update (prismaData.word.update)
    ↓
Database (interlex.db)
    ↓
UI Update (Table refresh)
```

## Key Design Patterns

1. **Dual Database Architecture**: Separation of authentication (auth.db) and lexical data (interlex.db) for security and scalability

2. **Role-Based Access Control (RBAC)**: Granular permission system with USER/MODERATOR/ADMIN roles and feature-specific permissions

3. **Bidirectional Relations**: Synonyms, antonyms, and cognates maintain referential integrity with cascade deletes

4. **Language-Agnostic Schema**: Dynamic language tables (en, ru, uk, etc.) with identical structure for easy extension

5. **Server-Side Rendering**: Next.js App Router with server components for optimal performance and SEO

6. **Client-Side Interactivity**: 'use client' components for dynamic features (search, editing, navigation)

7. **Internationalization**: next-intl for multi-language support with locale-aware routing

8. **Mobile-First Navigation**: Responsive HeaderNav with hamburger menu and absolute positioning overlay

9. **Virtual Scrolling**: TanStack Virtual for efficient handling of large datasets in admin tables

10. **Type Safety**: Strict TypeScript with explicit interfaces, avoiding 'any' types
