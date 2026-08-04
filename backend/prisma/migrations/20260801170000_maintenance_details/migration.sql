ALTER TABLE "MaintenanceLog"
ADD COLUMN "category" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "MaintenanceLog_status_priority_createdAt_idx"
ON "MaintenanceLog"("status", "priority", "createdAt");
