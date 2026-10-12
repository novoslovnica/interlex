#!/usr/bin/env bash
# Offsite-бэкапы продовых БД interlex: сервер 2 (этот скрипт живёт ТАМ) тянет
# с сервера 1 снапшоты через VACUUM INTO (консистентная копия живой WAL-базы),
# проверяет их и ротирует по схеме 7 дневных / 4 недельных / 12 месячных.
#
# Что бэкапим:
#   ежедневно  — interlex.db (словарь+сообщество), auth.db (пользователи), library.db
#   еженедельно (по понедельникам) — плюс corpus.db (~5 ГБ; в ежедневную ротацию
#                не входит из соображений объёма)
# Раскладка: /var/www/interlex-backups/{daily,weekly,monthly}/YYYY-MM-DD/*.db
#
# STAGING — каталог на СЕРВЕРЕ 1. Абсолютный путь обязателен: scp в
# OpenSSH >= 9 ходит по SFTP-протоколу и НЕ раскрывает ни $HOME, ни '~'
# (первый прогон из-за этого не нашёл снапшоты). Определяется ПОСЛЕ
# SERVER1_USER — здесь и раскрывается ${SERVER1_USER}.
#
# Подключение: passwordless-ключ server2 -> server1 уже настроен (см.
# docs/history/2026-09-24-bots-core.md, addendum 2026-10-01).
#
# Запуск: cron 04:23 ежедневно на сервере 2. Ручной прогон — просто запустить.

set -euo pipefail

SERVER1_USER="${SERVER1_USER:-admin}"
SERVER1_HOST="${SERVER1_HOST:?set SERVER1_HOST (IP сервера 1)}"
STAGING="/home/${SERVER1_USER}/interlex-offsite-staging"
SERVER1_DIR="/var/www/interslavic-lexicon.com/interlex"
BASE="/var/www/interlex-backups"
DAILY_DBS=("interlex.db" "auth.db" "library.db")
WEEKLY_EXTRA=("corpus.db")

DOW=$(date +%u)          # 1 = понедельник
DOM=$(date +%-d)
STAMP=$(date +%F)
log() { echo "[offsite-backup $(date '+%F %T')] $*"; }

# ── 1. Снапшоты на сервере 1 (VACUUM INTO в staging) ────────────────────────
DBS=("${DAILY_DBS[@]}")
if [ "$DOW" = "1" ]; then DBS+=("${WEEKLY_EXTRA[@]}"); fi

log "creating snapshots on server1: ${DBS[*]}"
for db in "${DBS[@]}"; do
    ssh "${SERVER1_USER}@${SERVER1_HOST}" "mkdir -p ${STAGING} && sqlite3 '${SERVER1_DIR}/${db}' \".backup '${STAGING}/${db}'\""
done

# ── 2. Забираем в сегодняшнюю дневную директорию ────────────────────────────
DEST="${BASE}/daily/${STAMP}"
mkdir -p "$DEST"
for db in "${DBS[@]}"; do
    log "pulling ${db}"
    scp -q "${SERVER1_USER}@${SERVER1_HOST}:${STAGING}/${db}" "${DEST}/${db}"
done
ssh "${SERVER1_USER}@${SERVER1_HOST}" "rm -f ${STAGING}/*.db"

# ── 3. Проверка целостности свежих копий ────────────────────────────────────
for db in "${DBS[@]}"; do
    result=$(sqlite3 "${DEST}/${db}" "PRAGMA quick_check;" | head -1)
    if [ "$result" != "ok" ]; then
        log "ERROR: integrity check failed for ${db}: ${result}"
        exit 1
    fi
done
log "integrity ok: ${DBS[*]}"

# ── 4. Недельные/месячные снапшоты (hardlink — место не тратится) ───────────
if [ "$DOW" = "1" ]; then
    mkdir -p "${BASE}/weekly/${STAMP}"
    for db in "${DBS[@]}"; do ln -f "${DEST}/${db}" "${BASE}/weekly/${STAMP}/${db}"; done
fi
if [ "$DOM" = "1" ]; then
    mkdir -p "${BASE}/monthly/${STAMP}"
    for db in "${DEST}"/*.db; do ln -f "$db" "${BASE}/monthly/${STAMP}/$(basename "$db")"; done
fi

# ── 5. Ротация ──────────────────────────────────────────────────────────────
rotate() { # rotate <dir> <keep>
    local dir="$1" keep="$2"
    ls -1d "${dir}"/*/ 2>/dev/null | sort | head -n "-${keep}" | while read -r old; do
        log "rotating away ${old}"
        rm -rf "$old"
    done
}
rotate "${BASE}/daily" 7
rotate "${BASE}/weekly" 4
rotate "${BASE}/monthly" 12

USED=$(du -sh "$BASE" | cut -f1)
log "done. total offsite size: ${USED}"
