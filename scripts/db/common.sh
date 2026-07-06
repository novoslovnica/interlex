# Prisma structure + FST tables
npx prisma db push
npm run init:db

# Initial data from Novoslovnica and Interslavic db
npm run fill:db
npm run fill:is:db

# Enrich words metadata from Derksen glossary
npx tsx ./scripts/db/enrich_words_metadata.ts

# Add proto tables from ESSJa
npx tsx ./scripts/db/seed-proto.ts

# Link words to proto-slavic translations (our)
# TODO

# Turn numeric root values to text
npx tsx ./scripts/extract-root-candidates.ts
npx tsx ./scripts/db/update-root-values.ts

# Create primary synonyms/antonyms links from Russian translations
# npx tsx ./scripts/db/make-json-for-python.ts
# bash call-python-script.sh
# npx tsx ./scripts/db/upload-synonyms-antonyms.ts