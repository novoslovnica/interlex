-- Rename "field" to "mainCategory" and "type" to "usageType" in lexemes and candidates
ALTER TABLE "lexemes" RENAME COLUMN "field" TO "mainCategory";
ALTER TABLE "lexemes" RENAME COLUMN "type" TO "usageType";
ALTER TABLE "candidates" RENAME COLUMN "field" TO "mainCategory";
ALTER TABLE "candidates" RENAME COLUMN "type" TO "usageType";