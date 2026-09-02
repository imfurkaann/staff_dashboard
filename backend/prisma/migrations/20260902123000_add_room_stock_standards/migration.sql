CREATE TABLE "RoomStockStandard" (
  "id" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "roomType" TEXT NOT NULL DEFAULT 'PERSONEL_ODASI',
  "fixedQuantity" INTEGER NOT NULL DEFAULT 0,
  "quantityPerBed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomStockStandard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoomStockStandard_quantity_check" CHECK ("fixedQuantity" >= 0 AND "quantityPerBed" >= 0 AND ("fixedQuantity" + "quantityPerBed") > 0)
);

CREATE UNIQUE INDEX "RoomStockStandard_stockItemId_key" ON "RoomStockStandard"("stockItemId");
CREATE INDEX "RoomStockStandard_roomType_idx" ON "RoomStockStandard"("roomType");
ALTER TABLE "RoomStockStandard" ADD CONSTRAINT "RoomStockStandard_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
