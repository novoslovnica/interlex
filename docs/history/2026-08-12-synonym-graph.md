# Synonym graph was wired up but silently broken for anonymous visitors — 2026-08-12 (RESOLVED)

> Вынесено из AGENTS.md при реструктуризации 2026-09-26.

While working through the roadmap's P3 feature backlog (`docs/roadmap.md`), the "add an interactive synonym graph to the word page" item turned out to already be built: `SynonymGraph.tsx` (a two-level radial SVG graph, first-level synonyms from the page's own already-loaded data, second level fetched from `/api/synonyms/second-level`) was already imported, wired to a visible "Graph" button next to every meaning's synonym list, and rendered in `Word.tsx` — not a stub.

**The bug**: `/api/synonyms/second-level` had required a session since the 2026-07-22 security audit (see `2026-07-22-security-audit.md`), but `/words/[id]` itself has no auth gate and already shows first-level synonyms to anyone. Clicking the graph button as an anonymous visitor got a `401` from the second-level fetch, and `SynonymGraph.tsx` didn't check `response.ok` before parsing — `Object.entries({error: "Unauthorized"})` fed a string into a loop expecting arrays, and `synonyms.filter is not a function` crashed the whole modal.

**Fix**: removed the session requirement on `/api/synonyms/second-level` — it's read-only data with no sensitivity beyond what the page already shows unauthenticated one level up, so the check was never protecting anything real (unlike `/api/corpus/analyze`'s `Feature.CorpusBuilder` gate, which stays — that one guards a real resource-intensive operation). Also hardened `SynonymGraph.tsx` to degrade gracefully (show first-level-only) on *any* fetch failure — network error, non-2xx, unexpected shape — rather than relying solely on the endpoint being reliable, since rate limiting (`proxy.ts`) can now legitimately 429 this same endpoint under heavy use.

### Key Files
- `app/api/synonyms/second-level/route.ts` — session check removed
- `app/words/[id]/SynonymGraph.tsx` — defensive fetch handling (`r.ok` check, `.catch()`, `Array.isArray` guard before `.filter()`)
