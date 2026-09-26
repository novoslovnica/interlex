# Smaller changes from the week of 2026-07-25 — briefly

> Вынесено из AGENTS.md при реструктуризации 2026-09-26.

- **React remount-on-every-keystroke bug** (`article form fix`, 2026-07-26): `ArticleForm.tsx` had `SelectField`/`TextField`/`NumberField` defined *inside* the parent component's function body — a new component identity every render, so React unmounted/remounted the inputs (and lost focus/local state) on every keystroke. Moved to module scope. Generic React pitfall worth checking for if similar symptoms show up elsewhere.
- **Per-flavor verification tool**: `LexemeAllophone.verified` (`Int?`, migration `scripts/db/2026-07-28-add-lexeme-allophone-verified-field.ts`) plus a Tinder-style admin card UI (`/admin/word-cards`) for moderators to approve/reject a lexeme's CORE flavorization one at a time — explicitly modeled as the per-flavor analog of the existing `Translation.verified` / `/admin/translation-cards` flow.
- `components/ShareButton.tsx` (copy-link, on the word page) and `components/AccentLegend.tsx` (four-tone accent system explainer popover — rendered as `<span role="button">` rather than `<button>` because it's nested inside another button in `Word.tsx`, and nested `<button>`s are invalid HTML) — small, self-contained UI additions, no architectural follow-up.
