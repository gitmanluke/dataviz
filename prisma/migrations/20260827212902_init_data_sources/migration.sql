-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'snowleopard',
    "datafileId" TEXT NOT NULL,
    "apiKeyCipher" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
