# Interlex Roadmap / Backlog

Приоритизированный список технического долга и возможных фич, составлен по итогам анализа проекта 2026-08-12. Источники: `AGENTS.md`, `ARCHITECTURE.md` ("Known Issues & Technical Debt"), прямой осмотр кода.

Статусы: ⬜ не начато · 🔄 в работе · ✅ сделано

---

## P0 — фундамент (дёшево, снижает риск всех остальных задач)

1. ✅ **Подключить vitest** (2026-08-12) — `vitest.config.mts`, `npm test`/`npm run test:run`. Сконвертированы `metrics.test.ts`, `morphology.test.ts` (все 20 assert → expect, все проходят) в реальные тесты; `declineNoun.test.ts` — в снапшот-тесты (старые `expectedForms` были праслав. реконструкциями, довирять их как "верные" нельзя без лингвиста, см. комментарий в файле). `analyze-text.test.ts`/`cqlParser.test.ts`/`tokenizer.test.ts` (без ассертов), `cqlTranslator.test.ts` (битый — левый импорт `@prisma/client`, несуществующий `analytics.db`), `CorpusInjector.test.ts` (пишет в живой `corpus.db`, сам `CorpusInjector` — мёртвый код) осознанно исключены из прогона, см. комментарии в `vitest.config.mts`. Попутно найдено и исправлено: `processors.ts` использовал `require()` внутри тела функций для уже статически импортированных модулей — не резолвилось под vitest/Vite, заменено на статические импорты (безопасно, те же модули уже импортировались в файле).
2. ✅ **CI на GitHub Actions** (2026-08-12) — `.github/workflows/ci.yml`: `test` (vitest) — блокирующий гейт, чистый; `lint` — запускается и виден, но `continue-on-error: true` (см. #12 — 205 реальных ошибок/116 warnings на момент внедрения, делать гейт блокирующим сейчас значило бы получить красный CI с первого дня); `build` — как есть, с текущим `ignoreBuildErrors: true`. Отдельный `tsc --noEmit` НЕ подключен: `tsconfig.json` сочетает `module: nodenext` + `moduleResolution: bundler` — комбинация, которую сам `tsc` CLI отвергает (TS5095/TS5109), хотя внутренний тайпчекер Next.js её принимает; обход через CLI-флаг даёт кучу ложных `Cannot find module` из-за другого алгоритма резолюции. De facto в проекте пока нет ни одного гейта типов — задача на будущее, не решена этим CI.
3. ✅ **`proxy.ts`** (2026-08-12, ранее назывался `middleware.ts` — в Next.js 16.2.9 конвенция переименована, см. `nextjs.org/docs/messages/middleware-to-proxy`) — грубая защита `/admin/**` и `/api/admin/**` по роли (ADMIN/MODERATOR) через `next-auth/jwt`'s `getToken` (без обращения к БД — `@/auth` тянет `PrismaAdapter`/`better-sqlite3`, несовместимые с Edge-рантаймом). Не заменяет точечные `checkPermission`/`requirePermission` в роутах. Проверено вживую: `/admin/words` без сессии редиректит, `/api/admin/*` возвращает `403 {"error":"Unauthorized"}`. Побочная находка: `redirect("/unauthorized")` в `lib/permissions.ts` ведёт на несуществующую страницу (сейчас 404) — уже было так до этой правки, не чинилось в рамках задачи.

## P1 — риски безопасности и целостности данных

4. ⬜ **Nonce/replay-защита для Telegram-логина** — валидный payload реплеится в течение 24ч окна (`auth.config.ts`).
5. ⬜ **Разрешить Prisma migration drift на `interlex.db`** (`prisma migrate diff` + ручная baseline-миграция) — сейчас `migrate dev` предлагает full reset живой БД.
6. ⬜ **`ų`/`u` нормализация в `DbAnalyzer`** — нужен лингвистический вердикт, код после решения тривиален. "sut" (2325+ вхождений) всё ещё не распознаётся.
7. ⬜ **Rate limiting на публичных API** (`/api/lexicon`, `/api/dict`, `/api/corpus/analyze`) — сейчас не нашлось нигде в коде.

## P2 — технический долг, повышающий вероятность будущих багов

8. ⬜ Унифицировать нейминг падежей (`'nominative'` vs `'nom'`) — вызывает баг отображения в `TokenSidebar`/`CorpusTokenDisplay`.
9. ⬜ `base_homonyms` формат в `app/admin/deduplication/actions.ts` не понимает новый `{id, flavor}[]` (4 из 33746 строк) — скопировать логику из `scripts/db/2026-07-29-merge-preposition-duplicate-lexemes.ts`.
10. ⬜ N+1 на `/words/[id]` — батчить языковые таблицы, обернуть `getItem()` в `React.cache`.
11. ⬜ Убрать `matchCount=0` неоднозначность у пунктуации в `tokenizer.ts`.
12. ⬜ Сократить `any` (100+ мест) — постепенно, попутно с другими задачами.
13. ⬜ AuditLog для `auth.db`/`corpus.db`/`library.db` — сейчас только `interlex.db`.

## P3 — фичи по теме проекта

14. ⬜ Граф/облако синонимов на странице слова (`SemanticRelation` + черновой `SynonymGraph.tsx` уже есть).
15. ⬜ Примеры из корпуса на странице слова (`CorpusToken.wordSlug` уже линкует к лексеме).
16. ⬜ Модераторская UI для `VerbGovernment`/предложного управления — разблокирует простаивающий Pass C дизамбигуации.
17. ⬜ Флэшкарты/повторение по CEFR и частотности (`cefrLevel`/`corpusFrequencyPerMln` уже посчитаны).
18. ⬜ Fuzzy-matching для RuWordNet (`lib/levenshtein.ts`) — поднимет текущие ~52% сопоставленных значений.

## P4 — крупные, долгие инициативы

19. ⬜ Рекурсивная обработка вложенных придаточных в syntax-парсере (`complexSentence.ts`).
20. ⬜ Векторные embeddings для семантического поиска/похожих слов.
21. ⬜ Публичный read-only API для сторонних интеграций.
22. ⬜ Расследовать утечку памяти Prisma в `$transaction` — перепроверить на будущих версиях Prisma перед новыми bulk-скриптами.

---

## Лог выполнения

- 2026-08-12: roadmap создан; P0 закрыт целиком (vitest, CI, proxy.ts). Новые находки по пути: `/unauthorized` страницы не существует (лежит в основе #3); tsconfig.json несовместим с прямым `tsc` CLI; реальный lint-долг вне мёртвого worktree-каталога — 205 ошибок / 116 warnings (уточняет масштаб #12).
