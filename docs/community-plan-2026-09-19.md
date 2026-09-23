# Направление 5. Сообщество и модель участия — план работ

## Context

Проект держится на одном мейнтейнере; очереди (сотни тысяч непроверенных переводов, 75 тыс. кластеров кандидатов, 2,5 млн омонимов) кодом не разгребаются. Источник: `docs/strategy-directions-2026-09-19.md:79-90`. Цель — дать любому залогиненному носителю славянского языка полезное действие «на 2 минуты», сделать вклад видимым, а решения — прозрачными.

Что показало исследование кода (важно для дизайна):
- `/admin/translation-cards` — готовый образец UI, но `audit_logs` содержит **0** записей `${lang}.verified`: поток ни разу не использовался. `verified=1` почти везде — флаг заливки.
- Нигде в коде нет голосов/консенсуса/репутации/публичного профиля. Нет поля «родной язык»: `UserSettings.language` — это «язык переводов для показа», может быть `"isv"`.
- У `User` нет публичного идентификатора; `AuditLog.userEmail` обязателен и для Telegram раскрывает ник → наружу нельзя.
- Самообслуживание пользователя (`FlashcardProgress`, `ApiKey`) — только сессия, без `Feature`; `Feature` заводится лишь для модераторского вида. Следуем этому.
- `proxy.ts` (Edge, без БД) лимитирует по IP; общий бакет 5/мин для публичной записи карточкам не годится → лимит по `userId` в самом роуте (`lib/rateLimit.ts::RateLimiter`, как в `lib/publicApi/rateLimit.ts`).
- Смена роли/прав в `app/admin/platform/users/page.tsx` не аудируется.

**Решения мейнтейнера (2026-09-19):**
1. Консенсус — **гибрид**: согласие «верно» ставит отдельную отметку «проверено сообществом», `Translation.verified` не трогаем; «неверно»/спор → очередь модератора.
2. Пул карточек — только `verified ≠ 1` (существующему `verified=1` доверяем).
3. Публичная идентичность — **ник по желанию**; без ника участник «Аноним», email наружу не уходит никогда.
4. Обсуждения — **постмодерация**, только залогиненные.

## Размещение данных

| Данные | БД | Почему |
|---|---|---|
| `user_languages`, `user_profiles`, `role_audit` | auth.db | привязаны к `User`, FK + cascade |
| `translation_votes`, `contributor_stats`, `word_comments`, новые колонки `translations` | interlex.db | выборка карточки — один запрос `translations` + «нет моего голоса»; `userId` — строка без FK (конвенция `ContentReport.submitterUserId`) |

Кросс-БД — только двухфазно (id-список → второй запрос → `Map`), образец `app/admin/reports/page.tsx:41-51`, `lib/srs/fetchFlashcardSession.ts`.

Миграции — raw-SQL скрипты `scripts/db/2026-09-XX-*.ts` по образцу `2026-08-14-add-api-keys.ts` (идемпотентно, `better-sqlite3`, транзакция, проверка в конце, бэкап `interlex.db.backup-before-community`), затем правка `.prisma`, `npm run db:gen-auth`/`db:gen-data`, **перезапуск процесса**. `prisma migrate dev` не запускать.

---

## Фаза 0. Фундамент: языки пользователя, ник, аудит ролей — сделано 2026-09-19

- **`UserLanguage`** (auth.db): `userId`, `language` (код из `TRANSLATION_LANGUAGE_CODES`, `lib/translations.ts:18`), `level` (`native|fluent`), `@@unique([userId, language])`. Несколько языков на пользователя. Голосовать можно только по своим языкам.
- **`UserProfile`** (auth.db, отдельная таблица — не трогаем NextAuth-таблицу `User`): `userId @unique`, `handle @unique` (3–30, `[a-z0-9_-]`, список зарезервированных), `bio?`, `createdAt`. Нет строки = аноним.
- `/settings`: две новые карточки («Мои языки», «Публичный ник») + server actions в `app/settings/actions.ts` по существующему шаблону `upsert`.
- **`RoleAudit`** (auth.db): `actorUserId`, `targetUserId`, `action` (`role_change|permission_grant|permission_revoke`), `oldValue`, `newValue`, `createdAt`; запись из `updateUserRole`/`toggleFeaturePermission`. (`AuditLog` не подходит: другая БД, `entityId Int`, а id пользователя — cuid.)
- `lib/community/identity.ts`: `resolvePublicNames(userIds) → Map<userId, handle|null>` — единственная точка, через которую имя участника попадает наружу.

## Фаза 1. Публичные карточки верификации перевода — сделано 2026-09-19

**Схема (interlex.db):**
- `translation_votes`: `id`, `translationId` (FK → translations, cascade), `language`, `userId`, `verdict` (`yes|no|unknown`), `suggestedValue?`, `comment?` (≤500), `valueSnapshot` (значение на момент голоса), `weight REAL default 1`, `isControl INT default 0`, `stale INT default 0`, `createdAt`; `UNIQUE(translationId, userId)`, индексы `(userId, createdAt)`, `(translationId)`.
- `translations` += `communityStatus TEXT NULL` (`confirmed|rejected|disputed`), `communityYes REAL default 0`, `communityNo REAL default 0`, `communityResolvedAt`; индекс `(language, communityStatus)`.

**Логика — `lib/community/` (чистые функции + vitest):**
- `consensus.ts::evaluateConsensus({yes, no, votes})`: `yes − no ≥ 3` → `confirmed`; `no − yes ≥ 3` → `rejected`; ≥7 значимых голосов без исхода → `disputed`; `unknown` не считается. Пороги — константы в одном месте.
- `selectCard.ts`: перевод языка из `UserLanguage` пользователя, `verified IS NOT 1`, `value` непустой, `communityStatus IS NULL`, нет моего голоса; сортировка: сначала уже начатые (1–2 голоса — добиваем до консенсуса), затем по `lexemes.corpusFrequencyPerMln DESC` со случайностью внутри окна топ-N (чтобы двое не получали одно и то же подряд). Исключать лексемы без значения/POS.
- `castVote.ts`: в одной `better-sqlite3`-транзакции — insert голоса, пересчёт счётчиков, `evaluateConsensus`, запись `communityStatus`. При `confirmed` — raw `INSERT INTO audit_logs` с `userEmail='community'`, `field='${lang}.communityStatus'` (шаблон синхронного аудита из `app/admin/deduplication/actions.ts`).
- **Инвалидация:** `lib/translations.ts::upsertTranslation` при смене `value` обнуляет `community*` и помечает голоса `stale=1`. Если модератор ставит `verified` — `communityStatus` закрывается решением модератора.

**API** (сессия, без `Feature`): `GET /api/community/translation-cards/next?lang=`, `POST /api/community/translation-cards/vote`. Лимит по `userId`: 30/мин + 500/сутки; валидация `verdict`, длины, принадлежности языка к `UserLanguage`.

**UI:** `/contribute` (server page → client-карточка; за основу `translation-cards-client.tsx`, но с `next-intl`, namespace `community` во всех трёх `messages/*.json`). Карточка: ISV-слово (латиница/кириллица по настройке), значение, примеры, переводы ru/en для контекста, проверяемый перевод; кнопки Верно / Неверно (+ необязательное «как правильно») / Не знаю / Пропустить; счётчик сессии. Без языков в профиле — мини-онбординг выбора языка. Аноним видит описание и кнопку входа.

**Точки входа:** пункт в `HeaderNav` (верхний уровень + пользовательское меню; проверить мобильное меню по правилам AGENTS.md), на странице слова рядом с непроверенным переводом — ненавязчивое «Знаете этот язык? Помогите проверить».

**Страница слова:** `Word.tsx` — значок у перевода: «проверено модератором» (`verified=1`) / «проверено сообществом» (`communityStatus='confirmed'`). Сейчас `verified` читается и нигде не показывается.

## Фаза 2. Очередь модератора, контрольные карточки, репутация — сделано 2026-09-19

- **`/admin/community-review`** — `Feature.CommunityReview` (просмотр), запись — по существующему `translate_${lang}`. Список `communityStatus IN ('rejected','disputed')` по языку: перевод, раскладка голосов, предложенные варианты (сгруппированы по частоте), комментарии. Действия: принять вариант / оставить как есть / отклонить — через существующие `upsertTranslation` + `logAudit`. Плитка-счётчик на `/admin/dashboard`, пункт в `AdminNav`.
- **Контрольные карточки (~10% выдачи, `isControl=1`, в консенсус не идут):** заведомо-«да» — перевод с `verified=1`; заведомо-«нет» — значение перевода *другого* случайного значения того же языка, подставленное на лету (в БД не сохраняется — лингвистический факт не фабрикуется). Ловит «кликаю всегда Верно» и калибрует репутацию с первого дня, не дожидаясь консенсусов.
- **`contributor_stats`** (interlex.db): `userId`, `language`, `votesTotal`, `votesResolved`, `votesAgreed`, `controlTotal`, `controlCorrect`, `accuracy`, `weight`, `updatedAt`; `UNIQUE(userId, language)`. Обновляется инкрементально при разрешении (консенсус или решение модератора — оно главнее) + `scripts/db/recompute-contributor-stats.ts` для полной пересборки.
- **`reputation.ts::computeWeight`**: до 20 разрешённых ответов — 1,0; далее по точности: <0,6 → 0,25; 0,6–0,8 → 1; 0,8–0,9 → 1,5; ≥0,9 → 2. Вес снимается в `translation_votes.weight` в момент голоса (снапшот, не пересчитывается задним числом). Провал контрольных (<50% на ≥10) → вес 0 и флаг для модератора.

## Фаза 3. Профиль, публичная статистика, предложение роли — сделано 2026-09-23

- **`/u/[handle]`**: ник, языки, дата начала, число ответов, доля согласия с итогом, подтверждённые переводы, активность по неделям. Данные: auth.db (handle→userId) → interlex.db (stats). Без ника страницы нет.
- **`/contribute/leaderboard`**: топ за неделю/всё время по языкам; участники без ника — «Аноним» без ссылки.
- **Публичный дашборд полноты (п.76 роадмапа)** — на `/contribute`: по каждому из 18 языков доли «модератор / сообщество / не проверено», сколько карточек в работе. Это же — призыв к волонтёрам.
- **Предложение роли:** `/admin/platform/users` — блок «Кандидаты в модераторы»: ≥200 разрешённых ответов по языку, точность ≥0,9, контрольные ≥0,9. Кнопка выдаёт `MODERATOR` + `translate_${lang}` + `CommunityReview` (запись в `RoleAudit`). Решение всегда за админом — автоматического повышения нет.
- Личная статистика и стрик на `/profile` (п.60 — частично).

## Фаза 4. Публичная история изменений слова (п.61) — сделано 2026-09-23

- Секция «История» на `/words/[id]`: `audit_logs` по `(entityType='Lexeme', entityId)` — индекс уже есть, — **сгруппировано по `actionId`** (в админке группировки нет), пагинация.
- Автор — только через `resolvePublicNames(userId)`; `userId=null`/нет ника → «Модератор»/«Аноним»; `community` → «Сообщество». **`userEmail` не выбирается в запросе вообще.**
- Белый список публичных полей (значение, переводы, грамматические поля, `communityStatus`); `*.message` и служебные — скрыты.

## Фаза 5. Обсуждение у слова — сделано 2026-09-23

- **`word_comments`** (interlex.db): `id`, `lexemeId` (FK, cascade), `parentId?` (один уровень вложенности), `userId`, `body` (≤4000, plain text + автоссылки на `/words/<id>` (страница слова ищет по числовому id)), `status` (`visible|hidden`), `hiddenByUserId?`, `moderatorNote?`, `createdAt`, `editedAt?`.
- Для комментирования **нужен ник** (анонимная публичная нить бессмысленна; согласуется с «ник по желанию» — без ника остаются карточки и чтение).
- Постмодерация: жалоба — существующий `ContentReport` (добавить `"Comment"` в `ENTITY_TYPES`, `app/api/reports/route.ts:11`); скрытие — в `/admin/reports`, новый `Feature.CommentsModerate`. Лимит по `userId`: 5/10 мин; для участников без единого засчитанного вклада — 2/час.
- Вкладка «Обсуждение (N)» на странице слова; лента последних обсуждений на `/contribute`.
- **Слияние лексем:** `lib/dedup/mergeLexemes.ts` и скрипты-слияния должны переносить `word_comments.lexemeId` (голоса едут сами — они на `translationId`, а значения переносятся строками). Зафиксировать в AGENTS.md.
- RFC-голосование (п.67) — **вне плана**: это смена модели управления; нить обсуждения — её техническая основа.

## Фаза 6. Запуск и дальнейшие типы микрозадач (контур, без детализации)

- Запуск: анонс в Telegram/Discord ISV, «слово дня»-подобный призыв; первые 2 недели мейнтейнер смотрит очередь `disputed/rejected` и калибрует пороги по факту.
- Следующие типы задач поверх тех же `consensus.ts`/`contributor_stats`: «предложи перевод» (для пустых mk/hsb/dsb), проверка CORE-флаворизации (`/admin/word-cards`), омонимы корпуса — только вместе с п.111 (одно решение закрывает N токенов) и в corpus.db со своей таблицей голосов.

---

## Критичные файлы

- Новые: `lib/community/{consensus,selectCard,castVote,reputation,identity}.ts` (+ `.test.ts`), `app/contribute/**`, `app/api/community/**`, `app/u/[handle]/page.tsx`, `app/admin/community-review/**`, `scripts/db/2026-09-XX-add-community-{auth,data}.ts`, `scripts/db/recompute-contributor-stats.ts`.
- Изменяемые: `prisma/auth.schema.prisma`, `prisma/data.schema.prisma`, `lib/translations.ts` (инвалидация в `upsertTranslation`), `app/words/[id]/Word.tsx` + `api.ts`, `app/settings/{page,settings-client,actions}.tsx`, `app/admin/platform/users/page.tsx`, `config/features.ts` (`CommunityReview`, `CommentsModerate`), `components/{HeaderNav,AdminNav}.tsx`, `app/api/reports/route.ts`, `messages/{isv,ru,en}.json`, `lib/dedup/mergeLexemes.ts`, `docs/roadmap.md`, `AGENTS.md`.

## Верификация

- `npx vitest run lib/community` — консенсус (пороги, `unknown`, веса), репутация, выборка карточки (исключение своих голосов, контрольные не идут в счётчики), инвалидация при смене `value`.
- Миграции: прогон дважды (идемпотентность) на копии БД в scratchpad, затем на реальных с бэкапом; `prisma validate`, `db:gen-*`, `next build`, `npm run lint`/`tsc` — не хуже ratchet-baseline.
- Сквозной сценарий в превью (`preview_start`): 3–4 тестовых пользователя в локальной auth.db → выбрать язык → 3 голоса «верно» → значок «проверено сообществом» на странице слова + запись в истории; 3 «неверно» → появление в `/admin/community-review` → решение модератора → пересчёт `contributor_stats`; правка значения модератором → счётчики сброшены, голоса `stale`.
- Проверки доступа: аноним → 401 на `vote`; язык не из `UserLanguage` → 403; 31-й голос за минуту → 429; USER на `/admin/community-review` → редирект.
- Приватность: `grep` по ответам `/u/*`, `/words/*`, `/api/community/*` — нет `email`/`userEmail`.
- Мобильное меню/десктоп `HeaderNav` — скриншоты обоих (`resize_window`).

## Порядок и объём

0 → 1 → 2 → 3 → 4 → 5; суммарно ~10–14 рабочих дней. После фаз 0–1 уже есть пригодный к анонсу продукт; фаза 2 обязательна до широкого анонса (без контрольных карточек и очереди модератора голоса некому разбирать и нечем защищаться от накрутки). Фазы 4 и 5 независимы от 2–3 и могут идти раньше при желании.
