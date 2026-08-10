CREATE INDEX "StockMovement_roomInventoryId_idx" ON "StockMovement"("roomInventoryId");

ALTER TABLE "StockMovement"
ADD CONSTRAINT "StockMovement_roomInventoryId_fkey"
FOREIGN KEY ("roomInventoryId") REFERENCES "RoomInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
