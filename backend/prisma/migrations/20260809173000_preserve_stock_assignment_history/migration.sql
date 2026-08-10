-- Assignment history is part of the stock ledger and must not disappear through cascades.
ALTER TABLE "RoomInventory" DROP CONSTRAINT IF EXISTS "RoomInventory_roomId_fkey";
ALTER TABLE "RoomInventory" ADD CONSTRAINT "RoomInventory_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_stockItemId_fkey";
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_stockItemId_fkey"
  FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Populate the ledger for personnel assignments created before personnel movements existed.
INSERT INTO "StockMovement" (
  "id", "stockItemId", "type", "quantity", "personnelInventoryId", "employeeId",
  "itemNameSnapshot", "reason", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text, i."stockItemId", 'PERSONNEL_ASSIGNMENT'::"StockMovementType", -1,
  i."id", i."employeeId", i."itemName", 'MEVCUT PERSONEL ZİMMETİ DEVİR KAYDI',
  i."createdById", i."assignedDate"
FROM "InventoryItem" i
WHERE i."stockItemId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "StockMovement" m
    WHERE m."personnelInventoryId" = i."id" AND m."type" = 'PERSONNEL_ASSIGNMENT'
  );

INSERT INTO "StockMovement" (
  "id", "stockItemId", "type", "quantity", "personnelInventoryId", "employeeId",
  "itemNameSnapshot", "reason", "createdById", "createdAt"
)
SELECT
  gen_random_uuid()::text, i."stockItemId",
  CASE WHEN i."status" = 'TESLİM_ALINAMADI'
    THEN 'RETIREMENT'::"StockMovementType"
    ELSE 'PERSONNEL_RETURN'::"StockMovementType"
  END,
  CASE WHEN i."status" = 'TESLİM_ALINAMADI' THEN -1 ELSE 1 END,
  i."id", i."employeeId", i."itemName",
  CASE WHEN i."status" = 'TESLİM_ALINAMADI'
    THEN 'PERSONELDEN TESLİM ALINAMADI'
    ELSE 'PERSONELDEN DEPOYA İADE'
  END,
  i."returnedById", i."returnedDate"
FROM "InventoryItem" i
WHERE i."stockItemId" IS NOT NULL AND i."returnedDate" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "StockMovement" m
    WHERE m."personnelInventoryId" = i."id"
      AND m."type" IN ('PERSONNEL_RETURN', 'RETIREMENT')
  );
