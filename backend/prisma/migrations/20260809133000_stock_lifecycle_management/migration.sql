-- Extend stock cards with professional inventory controls.
CREATE TABLE IF NOT EXISTS "StockItem" (
  "id" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "totalStock" INTEGER NOT NULL DEFAULT 0,
  "usedStock" INTEGER NOT NULL DEFAULT 0,
  "usedInRooms" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockItem_itemName_key" ON "StockItem"("itemName");

ALTER TABLE "StockItem"
  ADD COLUMN IF NOT EXISTS "itemCode" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENEL',
  ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'ADET',
  ADD COLUMN IF NOT EXISTS "warehouseLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "minimumStock" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "StockItem_itemCode_key" ON "StockItem"("itemCode");

ALTER TABLE "RoomInventory"
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM (
    'OPENING', 'RECEIPT', 'ADJUSTMENT', 'ROOM_ASSIGNMENT', 'ROOM_RETURN',
    'ROOM_TRANSFER', 'STATUS_CHANGE', 'REPLACEMENT', 'RETIREMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StockMovement" (
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

CREATE INDEX IF NOT EXISTS "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_roomId_createdAt_idx" ON "StockMovement"("roomId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");
DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Preserve the initial balance of existing stock cards in the audit trail.
INSERT INTO "StockMovement" (
  "id", "stockItemId", "type", "quantity", "itemNameSnapshot", "reason", "createdAt"
)
SELECT gen_random_uuid()::text, "id", 'OPENING'::"StockMovementType", "totalStock", "itemName", 'SİSTEME DEVİR BAKİYESİ', "createdAt"
FROM "StockItem"
WHERE "totalStock" > 0;
