#!/usr/bin/env bash
#
# Разовая выкладка работ по распознаванию корпуса на прод.
#
# Переносит corpus.db и одобренных кандидатов, воспроизводит правки словаря
# скриптами (interlex.db на проде НЕ заменяется — там свой словарь, который
# обрастает переводами) и запускает замкнутый цикл. Подробности и обоснование
# порядка шагов — docs/deploy-2026-08-25-recognition.md.
#
# Запускается ЛОКАЛЬНО, из корня проекта. Все удалённые шаги идут по ssh.
#
#   bash scripts/deploy-corpus.sh --dry-run     # показать план, ничего не делать
#   bash scripts/deploy-corpus.sh               # выполнить, со спросом перед подменой
#   bash scripts/deploy-corpus.sh --yes         # без вопросов
#   SUDO_PASSWORD=… bash scripts/deploy-corpus.sh   # если sudo просит пароль
#   bash scripts/deploy-corpus.sh --no-service  # сервис останавливаете сами
#
# Если sudo недоступен, выкладка делится на три фазы, между которыми вы сами
# останавливаете и запускаете сервис (простой — только на вторую фазу):
#   bash scripts/deploy-corpus.sh --phase=pre      # всё до подмены, сервис работает
#   sudo systemctl stop interslavic-lexicon.service
#   bash scripts/deploy-corpus.sh --phase=swap     # подмена и сборка
#   sudo systemctl start interslavic-lexicon.service
#   bash scripts/deploy-corpus.sh --phase=finish   # кандидаты, пересчёты, сверка
#
# Настройки берутся из .env.release (USERNAME/PASSWORD/HOST) и переменных
# окружения; любую можно переопределить:
#   REMOTE_DIR=/var/www/…/interlex SSH_USER=… SSH_HOST=… bash scripts/deploy-corpus.sh
#
set -euo pipefail

DRY_RUN=0
ASSUME_YES=0
SKIP_REMOTE_BACKUP=0
SKIP_SERVICE=0
PHASE=all
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --phase=pre) PHASE=pre; SKIP_SERVICE=1 ;;
    --phase=swap) PHASE=swap; SKIP_SERVICE=1 ;;
    --phase=finish) PHASE=finish; SKIP_SERVICE=1 ;;
    --yes) ASSUME_YES=1 ;;
    --no-remote-backup) SKIP_REMOTE_BACKUP=1 ;;
    --no-service) SKIP_SERVICE=1 ;;
    *) echo "Неизвестный аргумент: $arg" >&2; exit 1 ;;
  esac
done

# ── настройки ────────────────────────────────────────────────────────────────
if [ -f .env.release ]; then set -a; . ./.env.release; set +a; fi
SSH_USER="${SSH_USER:-${USERNAME:-}}"
SSH_HOST="${SSH_HOST:-${HOST:-}}"
SSH_PASSWORD="${SSH_PASSWORD:-${PASSWORD:-}}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/interslavic-lexicon.com/interlex}"
SERVICE="${SERVICE:-interslavic-lexicon.service}"
# Пароль для sudo на сервере. Пустой — значит sudo должен работать без пароля;
# если это не так, скрипт остановится ДО переноса файла, а не после.
SUDO_PASSWORD="${SUDO_PASSWORD:-}"
CANDIDATES_FILE="candidates-export.json"

say()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$SSH_USER" ] || die "Не задан пользователь ssh (USERNAME в .env.release или SSH_USER=)"
[ -n "$SSH_HOST" ] || die "Не задан хост ssh (HOST в .env.release или SSH_HOST=)"

# sshpass только если пароль задан; иначе обычный ssh по ключу.
if [ -n "$SSH_PASSWORD" ]; then
  command -v sshpass >/dev/null || die "Задан пароль, но sshpass не установлен (brew install sshpass)"
  export SSHPASS="$SSH_PASSWORD"
  SSH=(sshpass -e ssh -o StrictHostKeyChecking=accept-new)
else
  SSH=(ssh -o StrictHostKeyChecking=accept-new)
fi

remote() { "${SSH[@]}" "$SSH_USER@$SSH_HOST" "$@"; }

# Привилегированная команда на сервере. Пароль уходит через stdin, а не в
# аргументах: в списке процессов на той стороне его быть не должно.
remote_sudo() {
  local command="$1"
  if [ -n "$SUDO_PASSWORD" ]; then
    printf '%s\n' "$SUDO_PASSWORD" | remote "sudo -S -p '' $command"
  else
    remote "sudo -n $command"
  fi
}

# Удалённая команда в каталоге проекта. Всё, что меняет состояние, проходит
# через run_remote — в режиме --dry-run она только печатает.
run_remote() {
  local description="$1"; shift
  local command="$1"
  if [ "$DRY_RUN" = 1 ]; then
    info "[не выполняю] $description"
    info "              $command"
    return 0
  fi
  info "$description"
  remote "cd '$REMOTE_DIR' && $command" || die "Шаг не удался: $description"
}

# В фазовом режиме каждая фаза запускается отдельной командой — это и есть
# подтверждение, отдельных вопросов не задаём.
in_phase() {
  case "$PHASE" in
    all) return 0 ;;
    *) [ "$PHASE" = "$1" ] ;;
  esac
}

confirm() {
  [ "$PHASE" != all ] && return 0
  [ "$ASSUME_YES" = 1 ] && return 0
  [ "$DRY_RUN" = 1 ] && return 0
  printf '\n  %s [y/N] ' "$1"
  read -r answer </dev/tty
  case "$answer" in [yY]*) return 0 ;; *) die "Отменено пользователем" ;; esac
}

# ── 1. локальная проверка ────────────────────────────────────────────────────
say "1/10 Локальная проверка"
[ -f corpus.db ] || die "corpus.db не найден — запускать из корня проекта"

if [ -n "$(git status --porcelain)" ]; then
  info "ВНИМАНИЕ: в рабочем дереве есть незакоммиченные изменения — на прод они не поедут."
fi
UNPUSHED=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNPUSHED" != "0" ]; then
  info "Коммитов не отправлено в origin/main: $UNPUSHED — сейчас отправлю, прод тянет код через git pull."
fi
info "corpus.db: $(du -h corpus.db | cut -f1) (по сети пойдёт сжатым, примерно втрое меньше)"

say "2/10 Выгрузка одобренных кандидатов"
if [ "$DRY_RUN" = 1 ]; then
  info "[не выполняю] npx tsx scripts/db/export-candidates.ts $CANDIDATES_FILE"
else
  npx tsx scripts/db/export-candidates.ts "$CANDIDATES_FILE" || die "Не удалось выгрузить кандидатов"
fi

# ── 3. проверка сервера ──────────────────────────────────────────────────────
say "3/10 Проверка сервера"
remote "test -d '$REMOTE_DIR'" || die "На сервере нет каталога $REMOTE_DIR (переопределите REMOTE_DIR=)"
info "Каталог: $REMOTE_DIR"
remote "cd '$REMOTE_DIR' && echo '  ветка:' \$(git rev-parse --abbrev-ref HEAD) && echo '  базы:' && ls -lh *.db 2>/dev/null | awk '{print \"    \" \$9, \$5}' && echo '  диск:' && df -h . | tail -1 | awk '{print \"    свободно \" \$4}' && echo '  node:' \$(node -v 2>/dev/null || echo нет)"

# Проверяем sudo ЗАРАНЕЕ. Он нужен только на шаге 7 (остановка сервиса), но
# выяснять это после переноса 1,3 ГБ — значит встать посреди выкладки с
# подменённым наполовину состоянием. Ровно так и вышло при первой попытке.
if [ "$SKIP_SERVICE" = 1 ]; then
  # Сервисом управляет человек (--no-service или фазовый режим) — sudo скрипту
  # не нужен вовсе, проверять его нечего.
  info "sudo: не требуется, сервисом управляете вы"
elif [ "$DRY_RUN" = 1 ]; then
  info "[не проверяю] доступность sudo"
elif remote_sudo "true" >/dev/null 2>&1; then
  info "sudo: работает"
else
  die "sudo на сервере требует пароль, а он не задан.
  Либо запустите с SUDO_PASSWORD=… (уйдёт через stdin, в аргументах не появится),
  либо разрешите на сервере беспарольный systemctl для этого юнита, либо
  остановите и запустите сервис вручную, а скрипт прогоните с --no-service."
fi

LOCAL_BYTES=$(wc -c < corpus.db | tr -d ' ')
NEEDED_GB=$(( (LOCAL_BYTES * 2) / 1073741824 + 1 ))
info "Нужно свободного места: около ${NEEDED_GB} ГБ (новый файл + резервная копия старого)"
confirm "Продолжать?"

# ── 4. резервная копия на сервере ────────────────────────────────────────────
STAMP=$(date +%Y%m%d-%H%M%S)
if in_phase pre; then
say "4/10 Резервная копия баз на сервере"
if [ "$SKIP_REMOTE_BACKUP" = 1 ]; then
  info "Пропущено по --no-remote-backup"
else
  run_remote "копирую corpus.db и interlex.db" \
    "cp -f corpus.db corpus.db.backup-$STAMP 2>/dev/null || true; cp -f interlex.db interlex.db.backup-$STAMP"
fi

fi

# ── 5. код ───────────────────────────────────────────────────────────────────
if in_phase pre; then
say "5/10 Выкладка кода"
if [ "$DRY_RUN" = 1 ]; then
  info "[не выполняю] git push origin main"
else
  git push origin main || die "Не удалось отправить коммиты в origin"
fi
run_remote "git pull + npm ci" "git checkout main && git pull && npm ci"

fi

# ── 6. правки словаря (идемпотентны, до подмены корпуса) ─────────────────────
if in_phase pre; then
say "6/10 Правки словаря"
info "Идут ДО подмены корпуса: они меняют, как движок порождает формы."
for script in \
  "scripts/db/2026-08-24-add-je-inflection-anomaly.ts" \
  "scripts/db/2026-08-24-dedupe-inflection-anomalies.ts --apply" \
  "scripts/db/2026-08-24-fix-dictionary-defects.ts --apply" \
  "scripts/db/2026-08-24-add-athematic-a-present-endings.ts --apply"
do
  run_remote "$script" "npx tsx -r dotenv/config $script"
done

fi

# ── 7. перенос корпуса ───────────────────────────────────────────────────────
if in_phase pre; then
say "7/10 Перенос corpus.db (файл встаёт рядом как corpus.db.new, подмены ещё нет)"
LOCAL_SHA=$(shasum -a 256 corpus.db | cut -d' ' -f1)
info "sha256 локального файла: ${LOCAL_SHA:0:16}…"
if [ "$DRY_RUN" = 1 ]; then
  info "[не выполняю] gzip -c corpus.db | ssh … 'gunzip > corpus.db.new'"
else
  info "Передаю (это надолго; файл идёт сжатым потоком, без временных копий)…"
  gzip -1 -c corpus.db | remote "cd '$REMOTE_DIR' && gunzip -c > corpus.db.new" \
    || die "Передача не удалась"
  REMOTE_SHA=$(remote "cd '$REMOTE_DIR' && sha256sum corpus.db.new | cut -d' ' -f1")
  [ "$LOCAL_SHA" = "$REMOTE_SHA" ] || die "Контрольные суммы не совпали — файл повреждён при передаче, подмену не делаю"
  info "Контрольные суммы совпали"
fi

fi

if in_phase swap; then
confirm "Останавливаю сервис и подменяю corpus.db. Продолжать?"
if [ "$SKIP_SERVICE" = 1 ]; then
  info "Сервис не трогаю (--no-service). Остановите его сами ДО подмены:"
  info "  sudo systemctl stop $SERVICE"
  confirm "Сервис остановлен?"
elif [ "$DRY_RUN" = 1 ]; then
  info "[не выполняю] sudo systemctl stop $SERVICE"
else
  info "останавливаю $SERVICE"
  remote_sudo "systemctl stop $SERVICE" || die "Не удалось остановить сервис"
fi
run_remote "подменяю corpus.db" "mv -f corpus.db.new corpus.db && rm -f corpus.db-wal corpus.db-shm corpus.db-journal"

run_remote "сборка" "rm -rf .next && npm run build"
fi

# ── 8. кандидаты ─────────────────────────────────────────────────────────────
if in_phase finish; then
say "8/10 Кандидаты"
if [ "$DRY_RUN" = 1 ]; then
  info "[не выполняю] scp $CANDIDATES_FILE"
else
  if [ -n "$SSH_PASSWORD" ]; then
    sshpass -e scp -o StrictHostKeyChecking=accept-new "$CANDIDATES_FILE" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"
  else
    scp -o StrictHostKeyChecking=accept-new "$CANDIDATES_FILE" "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"
  fi
fi
run_remote "импорт кандидатов" "npx tsx scripts/db/import-candidates.ts $CANDIDATES_FILE --apply"

# ── 9. пересчёты ─────────────────────────────────────────────────────────────
say "9/10 Пересчёты"
info "Частотность и CEFR — после подмены корпуса: считаются по нему."
run_remote "частотность и CEFR" "npm run compute:frequency"
info "Первый corpus:refresh только выставит точку отсчёта — это ожидаемо."
run_remote "точка отсчёта цикла" "npm run corpus:refresh"

# ── 10. проверка ─────────────────────────────────────────────────────────────
say "10/10 Что получилось"
if [ "$DRY_RUN" = 1 ]; then
  info "[не выполняю] сверку итогов"
else
  remote "cd '$REMOTE_DIR' && npx tsx scripts/db/measure-corpus-recognition.ts --no-simulate" || true
  remote "systemctl is-active $SERVICE" || true
fi

fi

say "Готово"
[ "$PHASE" = pre ] && info "Фаза pre завершена. Теперь: sudo systemctl stop $SERVICE, затем --phase=swap"
[ "$PHASE" = swap ] && info "Фаза swap завершена. Теперь: sudo systemctl start $SERVICE, затем --phase=finish"
info "Резервные копии на сервере: corpus.db.backup-$STAMP, interlex.db.backup-$STAMP"
info "Откат корпуса: mv corpus.db.backup-$STAMP corpus.db && sudo systemctl restart $SERVICE"
