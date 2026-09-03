-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'es',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "isFirstSetupDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "forums" (
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
    "useFlaresolverr" BOOLEAN NOT NULL DEFAULT true,
    "flaresolverrSessionTTL" INTEGER NOT NULL DEFAULT 1800000
);

-- CreateTable
CREATE TABLE "forum_credentials" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forumId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    CONSTRAINT "forum_credentials_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "forums" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jdownloader_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL DEFAULT 'local',
    "connectionName" TEXT,
    "localHost" TEXT,
    "localPort" INTEGER,
    "email" TEXT,
    "password" TEXT,
    "deviceName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ai_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "model" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "flaresolverr_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "timeout" INTEGER NOT NULL DEFAULT 60000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "forumName" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "forumName" TEXT NOT NULL,
    "jDownloaderId" TEXT,
    "status" TEXT NOT NULL,
    "progress" REAL NOT NULL DEFAULT 0,
    "size" TEXT,
    "arrType" TEXT,
    "grabId" TEXT,
    "category" TEXT,
    "releaseTitle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "arr_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "arrType" TEXT NOT NULL,
    "arrUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "downloadId" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "tag" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arr_notifications_downloadId_fkey" FOREIGN KEY ("downloadId") REFERENCES "downloads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "arr_services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "testing_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "forums_torznabApiKey_key" ON "forums"("torznabApiKey");

-- CreateIndex
CREATE UNIQUE INDEX "forum_credentials_forumId_key" ON "forum_credentials"("forumId");

-- CreateIndex
CREATE UNIQUE INDEX "arr_services_apiKey_key" ON "arr_services"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "testing_settings_userId_key" ON "testing_settings"("userId");
