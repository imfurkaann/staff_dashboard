ALTER TABLE "MaintenanceLog" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "MaintenanceLog" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
ALTER TABLE "MaintenanceLog" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;
ALTER TABLE "MaintenanceEvent" ADD COLUMN IF NOT EXISTS "performedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_resolution_state_check";
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_resolution_state_check" CHECK (
  ("status" IN ('OPEN','IN_PROGRESS') AND "resolvedAt" IS NULL)
  OR ("status" IN ('RESOLVED','CLOSED') AND "resolvedAt" IS NOT NULL)
);
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_resolution_note_check";
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_resolution_note_check" CHECK (
  "status" NOT IN ('RESOLVED','CLOSED') OR ("resolutionNote" IS NOT NULL AND LENGTH(BTRIM("resolutionNote")) > 0)
);
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_closed_assignee_check";
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_closed_assignee_check" CHECK (
  "status" NOT IN ('RESOLVED','CLOSED') OR ("assignedTo" IS NOT NULL AND LENGTH(BTRIM("assignedTo")) > 0)
);
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_closed_service_return_check";
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_closed_service_return_check" CHECK (
  "status" NOT IN ('RESOLVED','CLOSED') OR "sentToServiceAt" IS NULL OR "returnedFromServiceAt" IS NOT NULL
);
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_inventory_status_check";
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_inventory_status_check" CHECK (
  "type" = 'GENERAL' OR "inventoryStatus" IN ('MAINTENANCE_REQUIRED','DAMAGED','LOST','IN_SERVICE','REPLACEMENT_REQUIRED')
);
ALTER TABLE "MaintenanceEvent" DROP CONSTRAINT IF EXISTS "MaintenanceEvent_performed_by_not_blank_check";
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_performed_by_not_blank_check" CHECK (LENGTH(BTRIM("performedBy")) > 0);

CREATE INDEX IF NOT EXISTS "MaintenanceLog_createdById_createdAt_idx" ON "MaintenanceLog"("createdById","createdAt");
CREATE INDEX IF NOT EXISTS "MaintenanceLog_updatedById_updatedAt_idx" ON "MaintenanceLog"("updatedById","updatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceLog_requestKey_key" ON "MaintenanceLog"("requestKey");
CREATE INDEX IF NOT EXISTS "MaintenanceEvent_performedById_createdAt_idx" ON "MaintenanceEvent"("performedById","createdAt");
