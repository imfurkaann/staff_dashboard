-- Prevent concurrent API paths from opening two active faults for the same room fixture.
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceLog_one_active_per_room_inventory"
  ON "MaintenanceLog"("roomInventoryId")
  WHERE "roomInventoryId" IS NOT NULL AND "status" IN ('OPEN', 'IN_PROGRESS');
