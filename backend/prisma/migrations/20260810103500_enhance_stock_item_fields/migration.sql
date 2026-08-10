-- Enhance StockItem table with expanded inventory fields
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'DEMİRBAŞ';
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "specifications" TEXT;
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "physicalStatus" TEXT NOT NULL DEFAULT 'KULLANILABİLİR';
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "warrantyEndDate" TIMESTAMP(3);
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "locationNote" TEXT;
