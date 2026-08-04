DROP INDEX IF EXISTS "Visitor_identityNoHash_idx";
ALTER TABLE "Visitor" DROP COLUMN IF EXISTS "identityNoHash";
ALTER TABLE "Visitor" DROP COLUMN IF EXISTS "identityNo";
