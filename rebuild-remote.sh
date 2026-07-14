cd /var/www/interslavic-lexicon.com/interlex
rm package-lock.json
rm -rf .next
rm interlex.db-shm
rm interlex.db-wal
git checkout main
ln -sfn /var/www/interslavic-lexicon.com/covers ./public/cover
git pull
npm i
npm run db:migrate-auth
npm run db:migrate-data
npm run db:migrate-library
npm run build
sudo systemctl restart interslavic-lexicon.service
