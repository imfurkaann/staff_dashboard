ALTER TABLE "RoomInventory" ADD COLUMN "assetTag" TEXT;

UPDATE "RoomInventory"
SET "assetTag" = 'ENV-' || UPPER(SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 10))
WHERE "assetTag" IS NULL;

CREATE UNIQUE INDEX "RoomInventory_assetTag_key" ON "RoomInventory"("assetTag");

ALTER TABLE "MaintenanceLog"
  ADD COLUMN "inventoryAssetTagSnapshot" TEXT,
  ADD COLUMN "serviceProvider" TEXT,
  ADD COLUMN "serviceReference" TEXT,
  ADD COLUMN "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "warrantyCovered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sentToServiceAt" TIMESTAMP(3),
  ADD COLUMN "returnedFromServiceAt" TIMESTAMP(3);

CREATE TABLE "MaintenanceEvent" (
  "id" TEXT NOT NULL,
  "maintenanceId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" "MaintenanceStatus",
  "toStatus" "MaintenanceStatus",
  "inventoryStatus" "RoomInventoryStatus",
  "notes" TEXT,
  "serviceProvider" TEXT,
  "serviceReference" TEXT,
  "laborCost" DOUBLE PRECISION,
  "partsCost" DOUBLE PRECISION,
  "warrantyCovered" BOOLEAN,
  "performedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceEvent_maintenanceId_createdAt_idx" ON "MaintenanceEvent"("maintenanceId", "createdAt");
CREATE INDEX "MaintenanceEvent_action_createdAt_idx" ON "MaintenanceEvent"("action", "createdAt");
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "MaintenanceLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "MaintenanceEvent" ("id", "maintenanceId", "action", "toStatus", "inventoryStatus", "notes", "performedBy", "createdAt")
SELECT ml."id", ml."id", 'MIGRATED_INITIAL_RECORD', ml."status", ml."inventoryStatus", ml."description", ml."reportedBy", ml."createdAt"
FROM "MaintenanceLog" ml;
