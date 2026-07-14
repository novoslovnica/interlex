# Экспортируем переменную окружения NVM
export NVM_DIR="$HOME/.nvm"
# Загружаем сам NVM и его автодополнение
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

cd /var/www/interslavic-lexicon.com/interlex
rm package-lock.json
rm -rf .next
# rm interlex.db-shm
# rm interlex.db-wal
git checkout main
git pull
npm i
# npm run db:migrate-auth
# npm run db:migrate-data
# npm run db:migrate-library
# Вам нужно сказать Prisma, чтобы она принудительно посчитала локальные миграции уже примененными.
# npx prisma migrate resolve --applied "название_папки_миграции"
npm run build
sudo systemctl restart interslavic-lexicon.service
