cd /var/www/interslavic-lexicon.com/interlex
git checkout master
git pull
npm i
npm run build
sudo mv interslavic-lexicon.service /etc/systemd/system/interslavic-lexicon.service
sudo systemctl daemon-reload
sudo systemctl restart interslavic-lexicon.servic
