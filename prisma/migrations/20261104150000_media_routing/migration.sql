-- Keyword uniqueness moves from the whole table to two partial indexes:
-- one general file per keyword, and one file per (keyword, reel).
ALTER TABLE "DeliverableFile" ADD COLUMN "mediaId" TEXT;
ALTER TABLE "ReplyDraft" ADD COLUMN "mediaId" TEXT, ADD COLUMN "candidateIds" TEXT;
DROP INDEX IF EXISTS "DeliverableFile_keyword_key";
CREATE UNIQUE INDEX "DeliverableFile_general_keyword_key" ON "DeliverableFile" ("keyword") WHERE "mediaId" IS NULL;
CREATE UNIQUE INDEX "DeliverableFile_media_keyword_key" ON "DeliverableFile" ("keyword", "mediaId") WHERE "mediaId" IS NOT NULL;
