# Telegram-бот-сервис (standalone)

Бот работает как **отдельный процесс на отдельном сервере** — на той машине, с которой Telegram реально может соединиться (inbound с его IP-диапазонов 149.154.160.0/20, 91.108.4.0/22 и т.д. не заблокирован провайдером/фаерволом). Основной сайт при этом живёт на своём сервере и к боту отношения не имеет.

- Webhook-апдейты приходят сюда, ответ уходит конвенцией прямого HTTP-ответа (`{method: "sendMessage", ...}`) — сервис не дёргает Bot API и **не нуждается в токене**.
- Логика та же, что у сайта: `lib/bots/core` (поиск, парадигмы, транслитерация, слово дня), обработка апдейта — `lib/bots/telegram/handle.ts`.
- Данные: **снапшот `interlex.db`** (файловая копия с сервера 1). Сервис читает его через `better-sqlite3` напрямую (`SQLITE_DB`) и через Prisma (`DATA_DATABASE_URL`) — обе переменные должны указывать на один и тот же файл. Снапшот обновляется по расписанию, после обновления сервис перезапускается (индексы строятся при старте, ~20–30 с).

## Сборка бандла

```bash
npm run bot:bundle     # → services/telegram-bot/dist/{server.mjs, package.json}
```

Бандлит только код проекта. Внешние зависимости (`better-sqlite3` — нативный!, `@prisma/client`, `@prisma/adapter-better-sqlite3`) остаются внешними и ставятся на целевой машине под её платформу.

## Деплой на сервер 2

```bash
scp -r services/telegram-bot/dist server2:/opt/interlex-telegram-bot
ssh server2 'cd /opt/interlex-telegram-bot && npm i --omit=dev'
```

### Env на сервере 2 (`/opt/interlex-telegram-bot/.env`)

```
TELEGRAM_WEBHOOK_SECRET=<тот же, что при setWebhook — обязателен>
DATA_DATABASE_URL=file:/opt/interlex-telegram-bot/data/interlex.db
SQLITE_DB=/opt/interlex-telegram-bot/data/interlex.db
BOT_PORT=8787
TELEGRAM_BOT_NAME=<опционально, @имя для подсказки в help>
```

### systemd (пример)

```ini
[Unit]
Description=Interslavic lexicon Telegram bot
After=network.target

[Service]
WorkingDirectory=/opt/interlex-telegram-bot
EnvironmentFile=/opt/interlex-telegram-bot/.env
ExecStart=/usr/bin/node /opt/interlex-telegram-bot/server.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### nginx + TLS (Telegram принимает webhook только по https)

```nginx
server {
    server_name bot.example.com;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
    }
}
```

Сервис слушает `0.0.0.0:8787`; снаружи закрывайте порт фаерволом, наружу публикуется только nginx. `GET /healthz` — проверка живости (`{"ok":true,"analyzerReady":...}`).

### Синхронизация снапшота БД с сервера 1

На сервере 1 (cron): сделать backup-копию основной БД в home (`.backup` — консистентная копия WAL-базы):

```bash
sqlite3 /var/www/interslavic-lexicon.com/interlex.db ".backup /home/admin/interlex-bot.db"
```

На сервере 2 (cron, чуть позже): забрать копию и перезапустить сервис (пересборка индексов под свежий словарь):

```bash
scp server1:/home/admin/interlex-bot.db /opt/interlex-telegram-bot/data/interlex.db
systemctl restart interlex-telegram-bot
```

## Регистрация webhook'а

```bash
# на машине, где есть TELEGRAM_BOT_TOKEN (напр. сервер 1, .env):
BOT_ORIGIN=https://bot.example.com npx tsx scripts/ops/telegram-set-webhook.ts
# или явно:
npx tsx scripts/ops/telegram-set-webhook.ts --origin https://bot.example.com
```

Скрипт idempotent. Если раньше webhook был направлен на основной сайт — просто перезапустите его с новым origin, старый URL перезапишется.

## Локальная разработка

```bash
npm run bot:start     # tsx, без бандла; env — из .env проекта
```
