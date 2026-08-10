-- Historical assignments must not block a physical device from returning to the same room.
DROP INDEX IF EXISTS "RoomInventory_roomId_itemName_serialNo_key";
CREATE INDEX IF NOT EXISTS "RoomInventory_serialNo_idx" ON "RoomInventory"("serialNo");

-- A physical serial number can have only one active location at any moment.
CREATE UNIQUE INDEX "RoomInventory_active_serialNo_key"
ON "RoomInventory"("serialNo")
WHERE "returnedAt" IS NULL AND "serialNo" IS NOT NULL;

-- A physical device can have only one open maintenance workflow.
CREATE UNIQUE INDEX "MaintenanceLog_active_roomInventoryId_key"
ON "MaintenanceLog"("roomInventoryId")
WHERE "roomInventoryId" IS NOT NULL AND "status" IN ('OPEN', 'IN_PROGRESS');

-- Room deletion must never erase audit/history records.
ALTER TABLE "MaintenanceLog" DROP CONSTRAINT IF EXISTS "MaintenanceLog_roomId_fkey";
ALTER TABLE "MaintenanceLog"
ADD CONSTRAINT "MaintenanceLog_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level balance and chronology guards protect data even outside the API.
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_nonnegative_balances_check"
CHECK ("totalStock" >= 0 AND "usedStock" >= 0 AND "usedInRooms" >= 0);

ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_allocations_not_over_total_check"
CHECK ("usedStock" + "usedInRooms" <= "totalStock");

ALTER TABLE "RoomInventory" ADD CONSTRAINT "RoomInventory_positive_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_nonnegative_costs_check"
CHECK ("laborCost" >= 0 AND "partsCost" >= 0);

ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_service_dates_check"
CHECK ("sentToServiceAt" IS NULL OR "returnedFromServiceAt" IS NULL OR "returnedFromServiceAt" >= "sentToServiceAt");
