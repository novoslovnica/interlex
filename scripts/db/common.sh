# Удаляем файл старой базы
rm interlex.db
rm -rf prisma/migrations

# Prisma structure + FST tables
npm run db:gen-data
npm run db:migrate-data
sleep 1s
npm run init:db

# Initial data from Novoslovnica and Interslavic db
npm run fill:db
npm run fill:is:db

# Enrich words metadata from Derksen glossary
npx tsx ./scripts/db/enrich_words_metadata.ts

# Add proto tables from ESSJa
npx tsx ./scripts/db/seed-proto.ts

# Turn numeric root values to text
npx tsx ./scripts/extract-root-candidates.ts
npx tsx ./scripts/db/update-root-values.ts
rm root-candidates.json

# Create synonyms/antonyms/synsets links from Russian translations
# npx tsx ./scripts/make-json-for-python.ts
# bash ./scripts/call-python-script.sh
npx tsx ./scripts/db/upload-synonyms-antonyms.ts
npx tsx ./scripts/db/upload-synsets.ts

npx tsx ./scripts/db/update-generated-meanings.ts
