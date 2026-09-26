# Security & Data-Integrity Audit — 2026-07-22 (Phase 1)

> Вынесено из AGENTS.md при реструктуризации 2026-09-26.

A full audit found and fixed the following (Phase 1 — see [ARCHITECTURE.md](../ARCHITECTURE.md) "Known Issues & Technical Debt" for the complete list including still-open items like the grammar engine ending bug, non-bidirectional relations, missing DB indexes, and lack of test coverage):
- SQL injection in `app/api/lexicon/services.ts` search (was string-interpolated, now parameterized).
- Missing permission check on `POST /api/word-relations/save` (was session-only; now checks the relation-specific `Feature`).
- Unauthenticated `POST /api/synonyms/second-level` and `POST /api/corpus/analyze` (now require a session / `Feature.CorpusBuilder`). **Revised 2026-08-12**: `/api/synonyms/second-level`'s session requirement was removed again — it's read-only data the public word page already shows unauthenticated one level up, and gating it just crashed `SynonymGraph.tsx` for anonymous visitors (see `2026-08-12-synonym-graph.md`) instead of protecting anything real.
- Non-constant-time HMAC comparison in Telegram auth (`auth.config.ts`, now uses `crypto.timingSafeEqual`).

When adding new API routes that mutate lexical or relation data, follow the pattern in `app/api/roots/[id]/route.ts` or `app/api/endings/route.ts`: `auth()` + `checkPermission(session, Feature.X)` returning `403`, not just a session-presence check. (This rule remains standing — it is repeated in AGENTS.md's Tech Stack section.)
