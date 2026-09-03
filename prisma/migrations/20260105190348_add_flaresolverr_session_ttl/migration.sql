-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_forums" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "searchPath" TEXT NOT NULL,
    "searchMode" TEXT,
    "cseId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "thankButtonSelector" TEXT,
    "linksContainerSelector" TEXT,
    "postTitleSelector" TEXT,
    "loginPath" TEXT,
    "usernameField" TEXT,
    "passwordField" TEXT,
    "loginFormSelector" TEXT,
    "persistentCookies" TEXT,
    "cookiesUpdatedAt" DATETIME,
    "flaresolverrSessionTTL" INTEGER NOT NULL DEFAULT 1800000
);
INSERT INTO "new_forums" ("baseUrl", "cookiesUpdatedAt", "createdAt", "cseId", "enabled", "id", "linksContainerSelector", "loginFormSelector", "loginPath", "name", "passwordField", "persistentCookies", "postTitleSelector", "searchMode", "searchPath", "thankButtonSelector", "updatedAt", "usernameField") SELECT "baseUrl", "cookiesUpdatedAt", "createdAt", "cseId", "enabled", "id", "linksContainerSelector", "loginFormSelector", "loginPath", "name", "passwordField", "persistentCookies", "postTitleSelector", "searchMode", "searchPath", "thankButtonSelector", "updatedAt", "usernameField" FROM "forums";
DROP TABLE "forums";
ALTER TABLE "new_forums" RENAME TO "forums";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
