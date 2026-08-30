/*
  Warnings:

  - You are about to drop the column `apiKeyCipher` on the `DataSource` table. All the data in the column will be lost.
  - You are about to drop the column `datafileId` on the `DataSource` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'files',
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sheetId" TEXT,
    "sheetModifiedAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "refreshInterval" TEXT NOT NULL DEFAULT 'manual',
    "syncError" TEXT
);
INSERT INTO "new_DataSource" ("createdAt", "description", "id", "lastSyncedAt", "name", "refreshInterval", "sheetId", "sheetModifiedAt", "status", "syncError", "type") SELECT "createdAt", "description", "id", "lastSyncedAt", "name", "refreshInterval", "sheetId", "sheetModifiedAt", "status", "syncError", "type" FROM "DataSource";
DROP TABLE "DataSource";
ALTER TABLE "new_DataSource" RENAME TO "DataSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
