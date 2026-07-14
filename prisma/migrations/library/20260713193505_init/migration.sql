-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "category" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEntry_slug_key" ON "LibraryEntry"("slug");
