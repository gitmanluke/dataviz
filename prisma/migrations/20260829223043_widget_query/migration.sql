-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Widget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dashboardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT 'null',
    "spec" TEXT,
    "query" TEXT,
    "dataSourceId" TEXT,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "w" INTEGER NOT NULL DEFAULT 4,
    "h" INTEGER NOT NULL DEFAULT 3,
    "minW" INTEGER,
    "minH" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Widget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Widget_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Widget" ("createdAt", "dashboardId", "data", "h", "id", "minH", "minW", "spec", "title", "type", "w", "x", "y") SELECT "createdAt", "dashboardId", "data", "h", "id", "minH", "minW", "spec", "title", "type", "w", "x", "y" FROM "Widget";
DROP TABLE "Widget";
ALTER TABLE "new_Widget" RENAME TO "Widget";
CREATE INDEX "Widget_dashboardId_idx" ON "Widget"("dashboardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
