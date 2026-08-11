ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Visitor_requestKey_key" ON "Visitor"("requestKey");
CREATE INDEX IF NOT EXISTS "Visitor_createdById_entryTime_idx" ON "Visitor"("createdById", "entryTime");
CREATE INDEX IF NOT EXISTS "Visitor_updatedById_idx" ON "Visitor"("updatedById");
CREATE INDEX IF NOT EXISTS "Visitor_deletedById_idx" ON "Visitor"("deletedById");
