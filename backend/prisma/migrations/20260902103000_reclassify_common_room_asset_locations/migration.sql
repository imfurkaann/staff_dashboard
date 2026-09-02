-- Ortak hizmet alanı (çamaşırhane vb.) bir zimmet sahibi değildir. Önceki
-- sürümde bu alanlara açılmış ortak eşya zimmetlerini cihazın sabit konumuna
-- dönüştürür; personel ve konaklama odası kullanım kayıtlarına dokunmaz.
-- Önce ilişkili oda zimmetlerinin stok rezervasyonunu kapatır; böylece aynı
-- cihaz depo ve oda ekranlarında iki kez görünmez.
UPDATE "StockItem" stock
SET "usedInRooms" = GREATEST(0, stock."usedInRooms" - legacy."quantity")
FROM (
  SELECT inventory."stockItemId", SUM(inventory."quantity")::integer AS "quantity"
  FROM "RoomInventory" inventory
  JOIN "SharedAsset" asset ON asset."currentRoomInventoryId" = inventory."id"
  JOIN "Room" room ON room."id" = asset."currentRoomId"
  WHERE room."roomType" <> 'PERSONEL_ODASI'
    AND asset."status" = 'LOANED'
    AND inventory."returnedAt" IS NULL
  GROUP BY inventory."stockItemId"
) legacy
WHERE stock."id" = legacy."stockItemId";

UPDATE "RoomInventory" inventory
SET
  "returnedAt" = CURRENT_TIMESTAMP,
  "notes" = COALESCE(inventory."notes" || ' ', '') || '[Sistem düzeltmesi: ortak hizmet alanı cihazı, oda zimmeti yerine sabit konum olarak sınıflandırıldı.]'
FROM "SharedAsset" asset
JOIN "Room" room ON room."id" = asset."currentRoomId"
WHERE asset."currentRoomInventoryId" = inventory."id"
  AND room."roomType" <> 'PERSONEL_ODASI'
  AND asset."status" = 'LOANED'
  AND inventory."returnedAt" IS NULL;

UPDATE "SharedAsset" asset
SET
  "status" = 'AVAILABLE',
  "currentHolderType" = NULL,
  "currentEmployeeId" = NULL,
  "currentRoomId" = NULL,
  "currentPersonnelInventoryId" = NULL,
  "currentRoomInventoryId" = NULL,
  "borrowedAt" = NULL,
  "expectedReturnDate" = NULL,
  "locationNote" = CONCAT(block."name", ' / Oda ', room."roomNumber")
FROM "Room" room
JOIN "Block" block ON block."id" = room."blockId"
WHERE asset."currentRoomId" = room."id"
  AND room."roomType" <> 'PERSONEL_ODASI'
  AND asset."status" = 'LOANED';

UPDATE "SharedAssetLog" log
SET
  "returnedAt" = COALESCE(log."returnedAt", log."createdAt"),
  "notes" = COALESCE(log."notes" || ' ', '') || '[Sistem düzeltmesi: ortak hizmet alanı sabit konum olarak sınıflandırıldı.]'
FROM "Room" room
WHERE log."roomId" = room."id"
  AND room."roomType" <> 'PERSONEL_ODASI'
  AND log."action" = 'CHECK_OUT'
  AND log."returnedAt" IS NULL;
