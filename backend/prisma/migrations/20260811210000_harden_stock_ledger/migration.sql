ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "requestKey" TEXT;

DO $$ BEGIN
  ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "StockItem_requestKey_key" ON "StockItem"("requestKey");
CREATE UNIQUE INDEX IF NOT EXISTS "StockMovement_requestKey_key" ON "StockMovement"("requestKey");
CREATE INDEX IF NOT EXISTS "StockItem_createdById_createdAt_idx" ON "StockItem"("createdById", "createdAt");

ALTER TABLE "StockItem" DROP CONSTRAINT IF EXISTS "StockItem_minimum_nonnegative_check";
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_minimum_nonnegative_check" CHECK ("minimumStock" >= 0);
ALTER TABLE "StockItem" DROP CONSTRAINT IF EXISTS "StockItem_type_check";
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_type_check" CHECK ("itemType" IN ('DEMİRBAŞ','SARF_MALZEME','ORTAK_EKİPMAN','ORTAK_KULLANIM'));
ALTER TABLE "StockItem" DROP CONSTRAINT IF EXISTS "StockItem_unit_check";
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_unit_check" CHECK ("unit" IN ('ADET','TAKIM','PAKET','KOLİ','METRE','LİTRE','SET','KİLOGRAM','RULO'));
ALTER TABLE "StockItem" DROP CONSTRAINT IF EXISTS "StockItem_physical_status_check";
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_physical_status_check" CHECK ("physicalStatus" IN ('KULLANILABİLİR','KULLANIMDA','BAKIMDA','HURDA'));
ALTER TABLE "StockItem" DROP CONSTRAINT IF EXISTS "StockItem_required_text_check";
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_required_text_check" CHECK (
  LENGTH(BTRIM("itemName")) > 0 AND LENGTH(BTRIM("category")) > 0 AND LENGTH(BTRIM("unit")) > 0
);

ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_quantity_semantics_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_semantics_check" CHECK (
  ("type" = 'OPENING' AND "quantity" >= 0)
  OR ("type" IN ('RECEIPT','ROOM_RETURN','PERSONNEL_RETURN') AND "quantity" > 0)
  OR ("type" IN ('ROOM_ASSIGNMENT','PERSONNEL_ASSIGNMENT','REPLACEMENT','RETIREMENT') AND "quantity" < 0)
  OR ("type" IN ('STATUS_CHANGE','ROOM_TRANSFER') AND "quantity" = 0)
  OR "type" = 'ADJUSTMENT'
);
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_snapshot_not_blank_check";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_snapshot_not_blank_check" CHECK (LENGTH(BTRIM("itemNameSnapshot")) > 0);
