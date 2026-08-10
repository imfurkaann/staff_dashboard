-- AlterTable
ALTER TABLE "RoomInventory" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "RoomInventory" ALTER COLUMN "location" DROP NOT NULL;
ALTER TABLE "RoomInventory" ALTER COLUMN "location" SET DEFAULT '';
