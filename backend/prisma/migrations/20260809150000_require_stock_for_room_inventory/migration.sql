ALTER TABLE "RoomInventory" ADD COLUMN IF NOT EXISTS "stockItemId" TEXT;

-- Auto-create missing StockItem records for legacy RoomInventory items
INSERT INTO "StockItem" ("id", "itemName", "category", "unit", "totalStock", "usedInRooms", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."itemName", 'GENEL', 'ADET', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "RoomInventory" r
WHERE r."stockItemId" IS NULL
ON CONFLICT ("itemName") DO NOTHING;

-- Map legacy RoomInventory records to StockItem by itemName
UPDATE "RoomInventory" r
SET "stockItemId" = s."id"
FROM "StockItem" s
WHERE r."stockItemId" IS NULL AND r."itemName" = s."itemName";

-- Delete any remaining orphan RoomInventory items if unmappable
DELETE FROM "RoomInventory" WHERE "stockItemId" IS NULL;

ALTER TABLE "RoomInventory" DROP CONSTRAINT IF EXISTS "RoomInventory_stockItemId_fkey";
ALTER TABLE "RoomInventory" ALTER COLUMN "stockItemId" SET NOT NULL;
ALTER TABLE "RoomInventory"
  ADD CONSTRAINT "RoomInventory_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
