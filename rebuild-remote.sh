cd /var/www/interslavic-lexicon.com/interlex
git checkout main
git pull
rm package-lock.json
rm -rf .next
npm i
npm run build
sudo systemctl restart interslavic-lexicon.service
