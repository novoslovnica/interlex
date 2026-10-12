#!/usr/bin/env bash
# Health-монитор продовых сервисов interlex. Живёт на сервере 2, cron раз в
# 5 минут. Проверяет: бот-сервис (localhost), основной сайт (по https),
# свежесть offsite-бэкапа, место на диске, активность systemd-юнита бота.
# При сбое шлёт одно сообщение в Telegram админу (повторно — только после
# восстановления, стейт-файл ~/.interlex-monitor-state).
#
# Env (файл ~/.interlex-monitor-env, chmod 600, НЕ в репозитории):
#   TELEGRAM_BOT_TOKEN — токен бота (для отправки алертов)
#   ADMIN_CHAT_ID      — числовой id чата/пользователя Telegram
#   SITE_URL           — https://interslavic-lexicon.com
set -u

ENV_FILE="$HOME/.interlex-monitor-env"
STATE_FILE="$HOME/.interlex-monitor-state"
LOG_TAG="interlex-monitor"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
SITE_URL="${SITE_URL:-https://interslavic-lexicon.com}"

failures=()

check() { # check <name> <cmd...>
    local name="$1"; shift
    if ! "$@" >/dev/null 2>&1; then failures+=("$name"); fi
}

check "bot-service" curl -sf --max-time 10 http://127.0.0.1:8787/healthz
check "website" curl -sf --max-time 15 "$SITE_URL" -o /dev/null
check "bot-unit" systemctl is-active --quiet interlex-telegram-bot

# Свежесть бэкапа: сегодняшняя дневная директория с 3+ файлами
if [ "$(find /var/www/interlex-backups/daily -maxdepth 1 -type d -name "$(date +%F)" 2>/dev/null | wc -l)" = "0" ]; then
    failures+=("offsite-backup-missing-today")
fi

# Место на диске < 3 ГБ — тревога
free_mb=$(df -m / | awk 'NR==2 {print $4}')
if [ "$free_mb" -lt 3072 ]; then failures+=("disk-low-${free_mb}MB"); fi

if [ "${#failures[@]}" -eq 0 ]; then
    if [ -f "$STATE_FILE" ]; then
        msg="✅ interlex monitor: всё восстановилось. Проверки зелёные."
        [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${ADMIN_CHAT_ID:-}" ] && \
            curl -sf --max-time 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
                -H "Content-Type: application/json" \
                -d "{\"chat_id\":\"${ADMIN_CHAT_ID}\",\"text\":\"${msg}\"}" >/dev/null 2>&1
        logger -t "$LOG_TAG" "recovered"
    fi
    rm -f "$STATE_FILE"
    exit 0
fi

sig=$(printf '%s;' "${failures[@]}")
if [ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "$sig" ]; then
    exit 0   # уже сообщали, ждём восстановления
fi
echo "$sig" > "$STATE_FILE"
msg="🚨 interlex monitor: ${failures[*]}"
logger -t "$LOG_TAG" "ALERT: ${failures[*]}"
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${ADMIN_CHAT_ID:-}" ]; then
    curl -sf --max-time 10 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\":\"${ADMIN_CHAT_ID}\",\"text\":\"${msg}\"}" >/dev/null 2>&1 || \
        logger -t "$LOG_TAG" "alert delivery failed"
else
    logger -t "$LOG_TAG" "TELEGRAM_BOT_TOKEN/ADMIN_CHAT_ID not set, alert only in syslog: ${msg}"
fi
