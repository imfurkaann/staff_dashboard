-- Location tracking was intentionally retired from the stock workflow.
ALTER TABLE "StockItem" DROP COLUMN IF EXISTS "warehouseLocation";

-- Physical counts and personnel-related warehouse movements.
ALTER TABLE "StockItem" ADD COLUMN "lastCountedAt" TIMESTAMP(3);
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'PERSONNEL_ASSIGNMENT';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'PERSONNEL_RETURN';

ALTER TABLE "StockMovement"
  ADD COLUMN "personnelInventoryId" TEXT,
  ADD COLUMN "employeeId" TEXT;

CREATE INDEX "StockMovement_employeeId_createdAt_idx" ON "StockMovement"("employeeId", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rebuild cached allocations from the authoritative active assignment records.
UPDATE "StockItem" s
SET "usedInRooms" = COALESCE((
  SELECT SUM(r."quantity")::INTEGER FROM "RoomInventory" r
  WHERE r."stockItemId" = s."id" AND r."returnedAt" IS NULL
), 0),
"usedStock" = COALESCE((
  SELECT COUNT(*)::INTEGER FROM "InventoryItem" i
  WHERE i."stockItemId" = s."id" AND i."returnedDate" IS NULL
), 0);

ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_total_nonnegative_check" CHECK ("totalStock" >= 0);
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_used_nonnegative_check" CHECK ("usedStock" >= 0 AND "usedInRooms" >= 0);
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_allocation_within_total_check" CHECK ("usedStock" + "usedInRooms" <= "totalStock");

ALTER TABLE "RoomInventory" ADD CONSTRAINT "RoomInventory_return_state_check" CHECK (
  ("returnedAt" IS NULL AND "status" <> 'RETIRED') OR
  ("returnedAt" IS NOT NULL AND "status" IN ('RETIRED', 'LOST'))
);
