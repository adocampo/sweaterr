/*
  Warnings:

  - Added the required column `torznabApiKey` to the `forums` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_forums" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "searchPath" TEXT NOT NULL,
    "searchMode" TEXT,
    "searchForumLabel" TEXT,
    "cseId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "torznabApiKey" TEXT NOT NULL,
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
INSERT INTO "new_forums" ("baseUrl", "cookiesUpdatedAt", "createdAt", "cseId", "enabled", "flaresolverrSessionTTL", "id", "linksContainerSelector", "loginFormSelector", "loginPath", "name", "passwordField", "persistentCookies", "postTitleSelector", "searchForumLabel", "searchMode", "searchPath", "thankButtonSelector", "torznabApiKey", "updatedAt", "usernameField") 
SELECT "baseUrl", "cookiesUpdatedAt", "createdAt", "cseId", "enabled", "flaresolverrSessionTTL", "id", "linksContainerSelector", "loginFormSelector", "loginPath", "name", "passwordField", "persistentCookies", "postTitleSelector", "searchForumLabel", "searchMode", "searchPath", "thankButtonSelector", 'fdd-' || lower(hex(randomblob(16))), "updatedAt", "usernameField" FROM "forums";
DROP TABLE "forums";
ALTER TABLE "new_forums" RENAME TO "forums";
CREATE UNIQUE INDEX "forums_torznabApiKey_key" ON "forums"("torznabApiKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
