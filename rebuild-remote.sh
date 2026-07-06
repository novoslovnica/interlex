cd /var/www/interslavic-lexicon.com/interlex
git checkout main
git pull
rm package-lock.json
npm i
npm run build
sudo systemctl restart interslavic-lexicon.service
