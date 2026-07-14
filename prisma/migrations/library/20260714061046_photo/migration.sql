/*
  Warnings:

  - You are about to drop the column `category` on the `LibraryEntry` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LibraryEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "genre" TEXT NOT NULL DEFAULT 'article',
    "topic" TEXT,
    "flavor" TEXT NOT NULL DEFAULT 'CORE',
    "body" TEXT,
    "source" TEXT,
    "yearWritten" INTEGER,
    "yearTranslated" INTEGER,
    "translator" TEXT,
    "addedById" TEXT,
    "addedBy" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "corpusSlug" TEXT,
    "summary" TEXT,
    "coverImage" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "parentId" INTEGER,
    "actionHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryEntry_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LibraryEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LibraryEntry" ("actionHistory", "addedBy", "addedById", "author", "body", "corpusSlug", "coverImage", "createdAt", "flavor", "id", "isPublic", "parentId", "slug", "source", "summary", "title", "translator", "updatedAt", "verified", "verifiedBy", "views", "yearTranslated", "yearWritten") SELECT "actionHistory", "addedBy", "addedById", "author", "body", "corpusSlug", "coverImage", "createdAt", "flavor", "id", "isPublic", "parentId", "slug", "source", "summary", "title", "translator", "updatedAt", "verified", "verifiedBy", "views", "yearTranslated", "yearWritten" FROM "LibraryEntry";
DROP TABLE "LibraryEntry";
ALTER TABLE "new_LibraryEntry" RENAME TO "LibraryEntry";
CREATE UNIQUE INDEX "LibraryEntry_slug_key" ON "LibraryEntry"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
