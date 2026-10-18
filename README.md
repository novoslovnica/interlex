# Interlex

Словарь, корпус и платформа изучения межславянского языка:
[interslavic-lexicon.com](https://www.interslavic-lexicon.com).

Next.js 16 (App Router), React, TypeScript, Tailwind CSS, Prisma 7 и NextAuth v5.
Пять отдельных SQLite-баз: `auth.db`, `interlex.db`, `library.db`, `corpus.db`,
`historical.db`. Файлы лежат в корне проекта и не входят в Git.

Перед изменениями прочитайте [AGENTS.md](AGENTS.md). Архитектурные решения и
инциденты описаны в [docs/history](docs/history), задачи — в [roadmap](docs/roadmap.md).

## Локальный запуск

Используйте Node.js 22 (как в CI) и зависимости из lock-файла:

```bash
npm ci
```

Создайте `.env` с отдельным секретом для разработки и путями к локальным базам:

```dotenv
AUTH_SECRET="replace-with-a-local-random-secret"
AUTH_DATABASE_URL="file:./auth.db"
DATA_DATABASE_URL="file:./interlex.db"
LIBRARY_DATABASE_URL="file:./library.db"
CORPUS_DATABASE_URL="file:./corpus.db"
HISTORICAL_DATABASE_URL="file:./historical.db"
SQLITE_DB="./interlex.db"
CORPUS_SQLITE_DB="./corpus.db"
```

Для входа добавьте настройки нужных OAuth/Telegram-провайдеров из
[auth.config.ts](auth.config.ts). Секреты и рабочие `.env` не коммитятся.

Сгенерируйте все пять клиентов (базы для генерации не требуются):

```bash
npm run db:gen-auth
npm run db:gen-data
npm run db:gen-library
npm run db:gen-corpus
npm run db:gen-historical
```

До запуска приложения нужны подготовленные локальные базы с исходными данными.
Генерация клиента не создаёт словарь, FTS-таблицы или корпус. Для разработчика с
доступом к production безопасное получение копий описано в
[AGENTS.md](AGENTS.md#production-data-changes-2026-09-24):
`bash scripts/local/pull-prod.sh --db=interlex`; для библиотеки/корпуса выберите
соответствующую базу. `auth.db` с production не скачивается — используйте отдельную
базу и аккаунты разработки. `historical.db` подготавливается из исторических
импортов. Не выполняйте `prisma db push`/`migrate dev` на рабочих копиях с данными:
история Prisma-миграций не является реестром всех действующих изменений схемы.

```bash
npm run dev
```

Сайт откроется на [localhost:3000](http://localhost:3000).

## Проверки

```bash
npm run test:run
npm run typecheck:gate
npm run lint:gate
npm run build
```

Гейты TypeScript и ESLint запрещают новые ошибки относительно сохранённого
baseline. Их успешное завершение не означает отсутствия старого долга.
`npm run test` запускает Vitest в режиме наблюдения.

## Базы и выкладка

Production — источник истины для словаря, пользователей и библиотеки. Изменения
схемы/данных проходят через [реестр скриптов](scripts/db/manifest.ts); базы нельзя
заменять локальными файлами при обычном релизе. Подробный порядок и правила
сохранения ручной разметки корпуса — в [AGENTS.md](AGENTS.md).

```bash
npm run db:status
npm run db:run -- scripts/db/<script>.ts
npm run db:run -- scripts/db/<script>.ts --apply
```

Для зарегистрированных data-скриптов первый запуск — dry run. Production:
commit/push → `bash release.sh`; схемные миграции применяются во время релиза.
Сборка выполняется в отдельном каталоге; готовый релиз переключается атомарно с
проверкой HTTP и автоматическим откатом. Ручной откат: `bash release.sh --rollback`.
Пути, блокировки и правила миграций — [docs/deployment.md](docs/deployment.md).
Данные меняются отдельно через `bash prod.sh run <script>` и затем `--apply`.
Авторизация сервера хранится в `.env.release` и не входит в Git.
