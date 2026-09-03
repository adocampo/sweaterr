-- CreateTable
CREATE TABLE "forums" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "searchPath" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "thankButtonSelector" TEXT,
    "linksContainerSelector" TEXT,
    "postTitleSelector" TEXT,
    "loginPath" TEXT,
    "usernameField" TEXT,
    "passwordField" TEXT,
    "loginFormSelector" TEXT
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
    "deviceName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "forum_credentials_forumId_key" ON "forum_credentials"("forumId");

-- CreateIndex
CREATE UNIQUE INDEX "arr_services_apiKey_key" ON "arr_services"("apiKey");
