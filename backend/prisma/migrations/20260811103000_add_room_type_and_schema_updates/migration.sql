-- AlterEnum
ALTER TYPE "NotificationTargetType" ADD VALUE 'GENDER';

-- DropForeignKey
ALTER TABLE "FacilityLog" DROP CONSTRAINT IF EXISTS "FacilityLog_userId_fkey";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "contractEndDate";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "roomType" TEXT DEFAULT 'PERSONEL_ODASI';

-- Update Room_capacity_range_check constraint to allow 0 capacity for non-personnel rooms (laundry, storage, tech room, etc.)
ALTER TABLE "Room" DROP CONSTRAINT IF EXISTS "Room_capacity_range_check";
ALTER TABLE "Room" ADD CONSTRAINT "Room_capacity_range_check" CHECK ("capacity" BETWEEN 0 AND 26);

-- AlterTable
ALTER TABLE "NotificationRecipient" DROP COLUMN IF EXISTS "isRead",
DROP COLUMN IF EXISTS "readAt";

-- DropTable
DROP TABLE IF EXISTS "FacilityLog";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryItem_stockItemId_idx" ON "InventoryItem"("stockItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationRecipient_userId_idx" ON "NotificationRecipient"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RoomInventory_stockItemId_idx" ON "RoomInventory"("stockItemId");
