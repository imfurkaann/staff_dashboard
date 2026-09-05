-- A stock card describes a product batch, not an individual physical device.
-- Preserve unique device codes, serial rules and assignment links.
DROP INDEX IF EXISTS "SharedAsset_stockItemId_key";
CREATE INDEX IF NOT EXISTS "SharedAsset_stockItemId_idx" ON "SharedAsset"("stockItemId");
