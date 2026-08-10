-- Add brand and serialNo columns to RoomInventory table
ALTER TABLE "RoomInventory" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "RoomInventory" ADD COLUMN IF NOT EXISTS "serialNo" TEXT;
