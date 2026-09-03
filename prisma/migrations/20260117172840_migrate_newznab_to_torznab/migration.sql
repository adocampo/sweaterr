/*
  Warnings:

  - You are about to drop the column `sabnzbdCategory` on the `forums` table. All the data in the column will be lost.

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
    "searchTitleOnly" BOOLEAN NOT NULL DEFAULT true,
    "searchInChildForums" BOOLEAN NOT NULL DEFAULT false,
    "torznabApiKey" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'torrent',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'es-ES',
    "seedersSelector" TEXT,
    "peersSelector" TEXT,
    "infohashSelector" TEXT,
    "magnetUriSelector" TEXT,
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
INSERT INTO "new_forums" ("baseUrl", "cookiesUpdatedAt", "createdAt", "cseId", "defaultLanguage", "enabled", "flaresolverrSessionTTL", "id", "linksContainerSelector", "loginFormSelector", "loginPath", "name", "passwordField", "persistentCookies", "postTitleSelector", "searchForumLabel", "searchInChildForums", "searchMode", "searchPath", "searchTitleOnly", "thankButtonSelector", "torznabApiKey", "updatedAt", "usernameField") SELECT "baseUrl", "cookiesUpdatedAt", "createdAt", "cseId", "defaultLanguage", "enabled", "flaresolverrSessionTTL", "id", "linksContainerSelector", "loginFormSelector", "loginPath", "name", "passwordField", "persistentCookies", "postTitleSelector", "searchForumLabel", "searchInChildForums", "searchMode", "searchPath", "searchTitleOnly", "thankButtonSelector", "torznabApiKey", "updatedAt", "usernameField" FROM "forums";
DROP TABLE "forums";
ALTER TABLE "new_forums" RENAME TO "forums";
CREATE UNIQUE INDEX "forums_torznabApiKey_key" ON "forums"("torznabApiKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
