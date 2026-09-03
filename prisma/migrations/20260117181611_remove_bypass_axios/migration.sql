/*
  Warnings:

  - You are about to drop the column `bypassAxios` on the `testing_settings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_testing_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_testing_settings" ("createdAt", "id", "updatedAt", "userId") SELECT "createdAt", "id", "updatedAt", "userId" FROM "testing_settings";
DROP TABLE "testing_settings";
ALTER TABLE "new_testing_settings" RENAME TO "testing_settings";
CREATE UNIQUE INDEX "testing_settings_userId_key" ON "testing_settings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
