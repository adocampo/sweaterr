-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jdownloader_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'local',
    "localHost" TEXT,
    "localPort" INTEGER,
    "email" TEXT,
    "password" TEXT,
    "deviceName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_jdownloader_configs" ("createdAt", "deviceName", "email", "enabled", "id", "password", "updatedAt") SELECT "createdAt", "deviceName", "email", "enabled", "id", "password", "updatedAt" FROM "jdownloader_configs";
DROP TABLE "jdownloader_configs";
ALTER TABLE "new_jdownloader_configs" RENAME TO "jdownloader_configs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
