-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'snowleopard',
    "datafileId" TEXT,
    "apiKeyCipher" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sheetId" TEXT,
    "sheetModifiedAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "refreshInterval" TEXT NOT NULL DEFAULT 'manual',
    "syncError" TEXT
);
INSERT INTO "new_DataSource" ("apiKeyCipher", "createdAt", "datafileId", "description", "id", "name", "status", "type") SELECT "apiKeyCipher", "createdAt", "datafileId", "description", "id", "name", "status", "type" FROM "DataSource";
DROP TABLE "DataSource";
ALTER TABLE "new_DataSource" RENAME TO "DataSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
