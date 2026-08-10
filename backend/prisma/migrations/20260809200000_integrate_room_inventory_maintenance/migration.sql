-- Tie room-inventory faults to the authoritative assignment and stock ledger.
CREATE TYPE "MaintenanceType" AS ENUM ('GENERAL', 'ROOM_INVENTORY');

ALTER TABLE "MaintenanceLog"
  ADD COLUMN "type" "MaintenanceType" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "roomInventoryId" TEXT,
  ADD COLUMN "inventoryStatus" "RoomInventoryStatus",
  ADD COLUMN "inventoryItemNameSnapshot" TEXT,
  ADD COLUMN "inventoryBrandSnapshot" TEXT,
  ADD COLUMN "inventorySerialNoSnapshot" TEXT,
  ADD COLUMN "inventoryQuantitySnapshot" INTEGER;

ALTER TABLE "StockMovement" ADD COLUMN "maintenanceId" TEXT;

CREATE INDEX "MaintenanceLog_roomInventoryId_status_idx" ON "MaintenanceLog"("roomInventoryId", "status");
CREATE INDEX "MaintenanceLog_type_createdAt_idx" ON "MaintenanceLog"("type", "createdAt");
CREATE INDEX "StockMovement_maintenanceId_idx" ON "StockMovement"("maintenanceId");

ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_roomInventoryId_fkey"
  FOREIGN KEY ("roomInventoryId") REFERENCES "RoomInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_maintenanceId_fkey"
  FOREIGN KEY ("maintenanceId") REFERENCES "MaintenanceLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_inventory_fault_shape_check" CHECK (
  ("type" = 'GENERAL' AND "roomInventoryId" IS NULL AND "inventoryStatus" IS NULL)
  OR
  ("type" = 'ROOM_INVENTORY' AND "roomInventoryId" IS NOT NULL AND "inventoryStatus" IS NOT NULL
    AND "inventoryItemNameSnapshot" IS NOT NULL AND "inventoryQuantitySnapshot" > 0)
);

-- An assignment can only have one unfinished fault workflow at a time.
CREATE UNIQUE INDEX "MaintenanceLog_one_active_inventory_fault_key"
  ON "MaintenanceLog"("roomInventoryId")
  WHERE "roomInventoryId" IS NOT NULL AND "status" IN ('OPEN', 'IN_PROGRESS');
