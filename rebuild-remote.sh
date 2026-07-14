cd /var/www/interslavic-lexicon.com/interlex
rm package-lock.json
rm -rf .next
git checkout main
ln -sfn /var/www/interslavic-lexicon.com/covers ./public/cover
git pull
npm i
npm run build
sudo systemctl restart interslavic-lexicon.service
