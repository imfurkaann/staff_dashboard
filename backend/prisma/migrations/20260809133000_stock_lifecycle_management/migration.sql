-- Extend stock cards with professional inventory controls.
ALTER TABLE "StockItem"
  ADD COLUMN "itemCode" TEXT,
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENEL',
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'ADET',
  ADD COLUMN "warehouseLocation" TEXT,
  ADD COLUMN "minimumStock" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "StockItem_itemCode_key" ON "StockItem"("itemCode");

ALTER TABLE "RoomInventory"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "returnedAt" TIMESTAMP(3);

CREATE TYPE "StockMovementType" AS ENUM (
  'OPENING', 'RECEIPT', 'ADJUSTMENT', 'ROOM_ASSIGNMENT', 'ROOM_RETURN',
  'ROOM_TRANSFER', 'STATUS_CHANGE', 'REPLACEMENT', 'RETIREMENT'
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
  "stockItemId" TEXT NOT NULL,
  "type" "StockMovementType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "roomId" TEXT,
  "roomInventoryId" TEXT,
  "itemNameSnapshot" TEXT NOT NULL,
  "roomLabelSnapshot" TEXT,
  "brand" TEXT,
  "serialNo" TEXT,
  "reason" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");
CREATE INDEX "StockMovement_roomId_createdAt_idx" ON "StockMovement"("roomId", "createdAt");
CREATE INDEX "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the initial balance of existing stock cards in the audit trail.
INSERT INTO "StockMovement" (
  "id", "stockItemId", "type", "quantity", "itemNameSnapshot", "reason", "createdAt"
)
SELECT gen_random_uuid()::text, "id", 'OPENING'::"StockMovementType", "totalStock", "itemName", 'SİSTEME DEVİR BAKİYESİ', "createdAt"
FROM "StockItem"
WHERE "totalStock" > 0;
