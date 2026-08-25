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
#
# Настройки берутся из .env.release (USERNAME/PASSWORD/HOST) и переменных
# окружения; любую можно переопределить:
#   REMOTE_DIR=/var/www/…/interlex SSH_USER=… SSH_HOST=… bash scripts/deploy-corpus.sh
#
set -euo pipefail

DRY_RUN=0
ASSUME_YES=0
SKIP_REMOTE_BACKUP=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes) ASSUME_YES=1 ;;
    --no-remote-backup) SKIP_REMOTE_BACKUP=1 ;;
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

confirm() {
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

LOCAL_BYTES=$(wc -c < corpus.db | tr -d ' ')
NEEDED_GB=$(( (LOCAL_BYTES * 2) / 1073741824 + 1 ))
info "Нужно свободного места: около ${NEEDED_GB} ГБ (новый файл + резервная копия старого)"
confirm "Продолжать?"

# ── 4. резервная копия на сервере ────────────────────────────────────────────
say "4/10 Резервная копия баз на сервере"
STAMP=$(date +%Y%m%d-%H%M%S)
if [ "$SKIP_REMOTE_BACKUP" = 1 ]; then
  info "Пропущено по --no-remote-backup"
else
  run_remote "копирую corpus.db и interlex.db" \
    "cp -f corpus.db corpus.db.backup-$STAMP 2>/dev/null || true; cp -f interlex.db interlex.db.backup-$STAMP"
fi

# ── 5. код ───────────────────────────────────────────────────────────────────
say "5/10 Выкладка кода"
if [ "$DRY_RUN" = 1 ]; then
  info "[не выполняю] git push origin main"
else
  git push origin main || die "Не удалось отправить коммиты в origin"
fi
run_remote "git pull + npm ci" "git checkout main && git pull && npm ci"

# ── 6. правки словаря (идемпотентны, до подмены корпуса) ─────────────────────
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

# ── 7. перенос корпуса ───────────────────────────────────────────────────────
say "7/10 Перенос corpus.db"
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

confirm "Останавливаю сервис и подменяю corpus.db. Продолжать?"
run_remote "останавливаю $SERVICE" "sudo systemctl stop $SERVICE"
run_remote "подменяю corpus.db" "mv -f corpus.db.new corpus.db && rm -f corpus.db-wal corpus.db-shm corpus.db-journal"

# ── 8. кандидаты и сборка ────────────────────────────────────────────────────
say "8/10 Кандидаты и сборка"
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
run_remote "сборка" "rm -rf .next && npm run build"
run_remote "запускаю $SERVICE" "sudo systemctl start $SERVICE"

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

say "Готово"
info "Резервные копии на сервере: corpus.db.backup-$STAMP, interlex.db.backup-$STAMP"
info "Откат корпуса: mv corpus.db.backup-$STAMP corpus.db && sudo systemctl restart $SERVICE"
