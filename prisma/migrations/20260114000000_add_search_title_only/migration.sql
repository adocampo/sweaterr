-- Add searchTitleOnly flag to forums for native search title-only filtering
ALTER TABLE "forums" ADD COLUMN "searchTitleOnly" BOOLEAN NOT NULL DEFAULT 1;
