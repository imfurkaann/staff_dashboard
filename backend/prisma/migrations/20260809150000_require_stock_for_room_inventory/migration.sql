-- Room assignments must originate from a central stock card.
-- Legacy unlinked rows were removed before this constraint was introduced.
ALTER TABLE "RoomInventory" DROP CONSTRAINT "RoomInventory_stockItemId_fkey";
ALTER TABLE "RoomInventory" ALTER COLUMN "stockItemId" SET NOT NULL;
ALTER TABLE "RoomInventory"
  ADD CONSTRAINT "RoomInventory_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
