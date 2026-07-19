-- Add frequency fields to lexemes table
ALTER TABLE lexemes ADD COLUMN corpusFrequency INTEGER;
ALTER TABLE lexemes ADD COLUMN corpusFrequencyPerMln REAL;
ALTER TABLE lexemes ADD COLUMN corpusRank INTEGER;
ALTER TABLE lexemes ADD COLUMN corpusHapax INTEGER;
