/*
  Warnings:

  - You are about to drop the column `priority` on the `SupportTicket` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Employee_status_idx";

-- DropIndex
DROP INDEX "RoomInventory_roomId_itemName_location_key";

-- DropIndex
DROP INDEX "StockMovement_roomInventoryId_idx";

-- AlterTable
ALTER TABLE "DisciplinaryNote" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MaintenanceLog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoomCleaningLog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoomInventory" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StockItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportTicket" DROP COLUMN "priority";
