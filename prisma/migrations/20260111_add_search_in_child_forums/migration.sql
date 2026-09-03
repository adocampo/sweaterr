-- Add searchInChildForums field to Forum
ALTER TABLE "forums" ADD COLUMN "searchInChildForums" BOOLEAN NOT NULL DEFAULT false;
