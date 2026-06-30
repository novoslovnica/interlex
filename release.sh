export $(grep -v '^#' .env.release | xargs)

sshpass -f <(printf '%s\n' $PASSWORD) scp .env $USERNAME@$HOST:/var/www/interslavic-lexicon.com/interlex/.env
sshpass -f <(printf '%s\n' $PASSWORD) scp .env.production $USERNAME@$HOST:/var/www/interslavic-lexicon.com/interlex/.env.production

sshpass -f <(printf '%s\n' $PASSWORD) ssh $USERNAME@$HOST 'bash -s' < rebuild-remote.sh
