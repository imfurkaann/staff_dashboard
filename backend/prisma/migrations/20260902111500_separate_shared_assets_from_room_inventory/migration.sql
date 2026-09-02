-- Bir stok kartındaki açık oda kayıtlarının tamamı ortak hizmet alanlarındaysa
-- ve kartta ortak cihaz tanımları varsa bu kayıtlar oda demirbaşı değildir.
-- Cihazları ortak kullanım katmanında bırakır, eski oda kaydını arşivler.
ALTER TABLE "SharedAsset" DROP CONSTRAINT "SharedAsset_holder_state_check";
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_holder_state_check" CHECK (
  (status = 'LOANED' AND "borrowedAt" IS NOT NULL AND (
    ("currentHolderType" = 'EMPLOYEE' AND "currentEmployeeId" IS NOT NULL AND "currentRoomId" IS NULL AND "currentRoomInventoryId" IS NULL)
    OR ("currentHolderType" = 'ROOM' AND "currentRoomId" IS NOT NULL AND "currentEmployeeId" IS NULL AND "currentRoomInventoryId" IS NOT NULL AND "currentPersonnelInventoryId" IS NULL)
    OR ("currentHolderType" = 'OTHER' AND "currentEmployeeId" IS NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NULL AND "currentRoomInventoryId" IS NULL)
  ))
  OR (status <> 'LOANED' AND "currentHolderType" IS NULL AND "currentEmployeeId" IS NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NULL AND "currentRoomInventoryId" IS NULL AND "borrowedAt" IS NULL AND "expectedReturnDate" IS NULL)
);

UPDATE "StockItem" stock
SET "usedInRooms" = GREATEST(0, stock."usedInRooms" - legacy."quantity")
FROM (
  SELECT inventory."stockItemId", SUM(inventory."quantity")::integer AS "quantity"
  FROM "RoomInventory" inventory
  WHERE inventory."returnedAt" IS NULL
    AND EXISTS (SELECT 1 FROM "SharedAsset" asset WHERE asset."stockItemId" = inventory."stockItemId")
    AND NOT EXISTS (
      SELECT 1
      FROM "RoomInventory" personnel_inventory
      JOIN "Room" personnel_room ON personnel_room."id" = personnel_inventory."roomId"
      WHERE personnel_inventory."stockItemId" = inventory."stockItemId"
        AND personnel_inventory."returnedAt" IS NULL
        AND personnel_room."roomType" = 'PERSONEL_ODASI'
    )
  GROUP BY inventory."stockItemId"
) legacy
WHERE stock."id" = legacy."stockItemId";

UPDATE "RoomInventory" inventory
SET
  "returnedAt" = CURRENT_TIMESTAMP,
  "status" = 'RETIRED',
  "notes" = COALESCE(inventory."notes" || ' ', '') || '[Sistem düzeltmesi: ortak kullanım cihazı oda demirbaşı listesinden ayrıldı.]'
WHERE inventory."returnedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "SharedAsset" asset WHERE asset."stockItemId" = inventory."stockItemId")
  AND NOT EXISTS (
    SELECT 1
    FROM "RoomInventory" personnel_inventory
    JOIN "Room" personnel_room ON personnel_room."id" = personnel_inventory."roomId"
    WHERE personnel_inventory."stockItemId" = inventory."stockItemId"
      AND personnel_inventory."returnedAt" IS NULL
      AND personnel_room."roomType" = 'PERSONEL_ODASI'
  );

UPDATE "StockItem" stock
SET "itemType" = 'ORTAK_EŞYA'
WHERE EXISTS (SELECT 1 FROM "SharedAsset" asset WHERE asset."stockItemId" = stock."id")
  AND NOT EXISTS (
    SELECT 1
    FROM "RoomInventory" inventory
    JOIN "Room" room ON room."id" = inventory."roomId"
    WHERE inventory."stockItemId" = stock."id"
      AND inventory."returnedAt" IS NULL
      AND room."roomType" = 'PERSONEL_ODASI'
  );

-- Eski sürümün ortak cihaz kullanımı için açtığı kişisel zimmet satırlarını
-- kapatır. Aktif kullanım SharedAsset üzerindeki kullanıcı ve açık CHECK_OUT
-- kaydıyla devam eder; personelin kalıcı zimmet listesinde görünmez.
UPDATE "InventoryItem" inventory
SET
  "returnedDate" = CURRENT_TIMESTAMP,
  "status" = 'TAM_İADE_ALINDI',
  "notes" = COALESCE(inventory."notes" || ' ', '') || '[Sistem düzeltmesi: ortak kullanım kaydı kişisel zimmetten ayrıldı.]'
FROM "SharedAsset" asset
WHERE asset."currentPersonnelInventoryId" = inventory."id"
  AND asset."status" = 'LOANED'
  AND inventory."returnedDate" IS NULL;

UPDATE "StockItem" stock
SET "usedStock" = COALESCE((
  SELECT COUNT(*)::integer
  FROM "InventoryItem" inventory
  WHERE inventory."stockItemId" = stock."id"
    AND inventory."returnedDate" IS NULL
    AND inventory."isDeleted" = FALSE
), 0);

UPDATE "SharedAsset"
SET "currentPersonnelInventoryId" = NULL
WHERE "status" = 'LOANED'
  AND "currentPersonnelInventoryId" IS NOT NULL;
