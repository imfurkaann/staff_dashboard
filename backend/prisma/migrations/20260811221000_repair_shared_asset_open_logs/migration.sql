-- Rebuild the active checkout audit row when an old conflicting loan was replaced
-- by the authoritative room/personnel inventory during the previous migration.
INSERT INTO "SharedAssetLog" (
  id, "assetId", action, "assetCodeSnapshot", "assetNameSnapshot", "holderType",
  "statusFrom", "statusTo", "borrowerName", "employeeId", "roomId",
  "borrowedAt", "expectedReturnDate", notes, "createdAt"
)
SELECT
  SUBSTRING(md5(a.id || ':ACTIVE_CHECKOUT') FROM 1 FOR 8) || '-' ||
  SUBSTRING(md5(a.id || ':ACTIVE_CHECKOUT') FROM 9 FOR 4) || '-4' ||
  SUBSTRING(md5(a.id || ':ACTIVE_CHECKOUT') FROM 14 FOR 3) || '-a' ||
  SUBSTRING(md5(a.id || ':ACTIVE_CHECKOUT') FROM 18 FOR 3) || '-' ||
  SUBSTRING(md5(a.id || ':ACTIVE_CHECKOUT') FROM 21 FOR 12),
  a.id, 'CHECK_OUT', a."assetCode", a."assetName", a."currentHolderType",
  'AVAILABLE', 'LOANED',
  CASE
    WHEN e.id IS NOT NULL THEN CONCAT(e."firstName", ' ', e."lastName")
    WHEN r.id IS NOT NULL THEN CONCAT(b.name, ' / Oda ', r."roomNumber")
    ELSE 'Harici kullanıcı'
  END,
  a."currentEmployeeId", a."currentRoomId", a."borrowedAt", a."expectedReturnDate",
  'Sistem bütünlük düzeltmesi: aktif stok zimmeti ortak eşya geçmişiyle eşitlendi.',
  a."borrowedAt"
FROM "SharedAsset" a
LEFT JOIN "Employee" e ON e.id = a."currentEmployeeId"
LEFT JOIN "Room" r ON r.id = a."currentRoomId"
LEFT JOIN "Block" b ON b.id = r."blockId"
WHERE a.status = 'LOANED'
  AND NOT EXISTS (
    SELECT 1 FROM "SharedAssetLog" l
    WHERE l."assetId" = a.id AND l.action = 'CHECK_OUT' AND l."returnedAt" IS NULL
  );
