-- Several unmapped files may share a keyword (one per reel, attached later by the admin).
-- Only the per-reel uniqueness stays: one file per (keyword, reel).
DROP INDEX IF EXISTS "DeliverableFile_general_keyword_key";
