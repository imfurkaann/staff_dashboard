-- Link shared assets to their authoritative stock cards and active assignments.
ALTER TABLE "SharedAsset"
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "stockItemId" TEXT,
  ADD COLUMN "currentPersonnelInventoryId" TEXT,
  ADD COLUMN "currentRoomInventoryId" TEXT,
  ADD COLUMN "createdById" TEXT;

ALTER TABLE "SharedAssetLog"
  ADD COLUMN "requestKey" TEXT,
  ADD COLUMN "assetCodeSnapshot" TEXT,
  ADD COLUMN "assetNameSnapshot" TEXT,
  ADD COLUMN "holderType" TEXT,
  ADD COLUMN "statusFrom" "SharedAssetStatus",
  ADD COLUMN "statusTo" "SharedAssetStatus";

ALTER TABLE "StockMovement" ADD COLUMN "sharedAssetId" TEXT;

UPDATE "SharedAsset" sa
SET "stockItemId" = (
  SELECT si.id
  FROM "StockItem" si
  WHERE si."itemType" IN ('ORTAK_EKİPMAN', 'ORTAK_KULLANIM')
    AND (si."itemCode" = sa."assetCode" OR si."itemName" = sa."assetName")
  ORDER BY CASE WHEN si."itemCode" = sa."assetCode" THEN 0 ELSE 1 END, si."createdAt"
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "StockItem" si
  WHERE si."itemType" IN ('ORTAK_EKİPMAN', 'ORTAK_KULLANIM')
    AND (si."itemCode" = sa."assetCode" OR si."itemName" = sa."assetName")
);

UPDATE "SharedAssetLog" l
SET "assetCodeSnapshot" = a."assetCode",
    "assetNameSnapshot" = a."assetName",
    "holderType" = CASE
      WHEN l."employeeId" IS NOT NULL THEN 'EMPLOYEE'
      WHEN l."roomId" IS NOT NULL THEN 'ROOM'
      WHEN l."action" = 'CHECK_OUT' THEN 'OTHER'
      ELSE NULL
    END
FROM "SharedAsset" a
WHERE a.id = l."assetId";

ALTER TABLE "SharedAssetLog"
  ALTER COLUMN "assetCodeSnapshot" SET NOT NULL,
  ALTER COLUMN "assetNameSnapshot" SET NOT NULL;

-- Existing room/personnel inventory is the source of truth when an old shared-asset
-- loan conflicts with an already active stock assignment.
WITH chosen_room AS (
  SELECT DISTINCT ON (sa.id) sa.id AS "assetId", r.id, r."roomId", r."installedAt"
  FROM "SharedAsset" sa
  JOIN "RoomInventory" r ON r."stockItemId" = sa."stockItemId" AND r."returnedAt" IS NULL
  ORDER BY sa.id, r."updatedAt" DESC
)
UPDATE "SharedAsset" sa
SET "currentRoomInventoryId" = ri.id,
    "currentRoomId" = ri."roomId",
    "currentEmployeeId" = NULL,
    "currentPersonnelInventoryId" = NULL,
    "currentHolderType" = 'ROOM',
    status = 'LOANED',
    "borrowedAt" = ri."installedAt"
FROM chosen_room ri
WHERE ri."assetId" = sa.id;

WITH chosen_personnel AS (
  SELECT DISTINCT ON (sa.id) sa.id AS "assetId", i.id, i."employeeId", i."assignedDate"
  FROM "SharedAsset" sa
  JOIN "InventoryItem" i ON i."stockItemId" = sa."stockItemId" AND i."returnedDate" IS NULL AND i."isDeleted" = FALSE
  WHERE sa."currentRoomInventoryId" IS NULL
  ORDER BY sa.id, i."updatedAt" DESC
)
UPDATE "SharedAsset" sa
SET "currentPersonnelInventoryId" = ii.id,
    "currentEmployeeId" = ii."employeeId",
    "currentRoomId" = NULL,
    "currentRoomInventoryId" = NULL,
    "currentHolderType" = 'EMPLOYEE',
    status = 'LOANED',
    "borrowedAt" = ii."assignedDate"
FROM chosen_personnel ii
WHERE ii."assetId" = sa.id;

UPDATE "SharedAsset" sa
SET status = 'RETIRED', "currentHolderType" = NULL, "currentEmployeeId" = NULL,
    "currentRoomId" = NULL, "currentPersonnelInventoryId" = NULL,
    "currentRoomInventoryId" = NULL, "borrowedAt" = NULL, "expectedReturnDate" = NULL
FROM "StockItem" si
WHERE si.id = sa."stockItemId"
  AND sa."currentPersonnelInventoryId" IS NULL AND sa."currentRoomInventoryId" IS NULL
  AND (si."physicalStatus" = 'HURDA' OR si."isActive" = FALSE OR (
    si."totalStock" = 0 AND EXISTS (
      SELECT 1 FROM "StockMovement" sm WHERE sm."stockItemId" = si.id AND sm.type = 'RETIREMENT'
    )
  ));

UPDATE "SharedAsset"
SET "currentHolderType" = 'OTHER'
WHERE status = 'LOANED' AND "currentHolderType" IS NULL
  AND "currentEmployeeId" IS NULL AND "currentRoomId" IS NULL;

UPDATE "SharedAsset"
SET "currentHolderType" = 'OTHER', "currentEmployeeId" = NULL, "currentRoomId" = NULL,
    "currentPersonnelInventoryId" = NULL, "currentRoomInventoryId" = NULL,
    "borrowedAt" = COALESCE("borrowedAt", "createdAt")
WHERE status = 'LOANED' AND "currentRoomInventoryId" IS NULL AND "currentPersonnelInventoryId" IS NULL;

UPDATE "SharedAsset" a
SET status = 'AVAILABLE', "currentHolderType" = NULL, "borrowedAt" = NULL, "expectedReturnDate" = NULL
FROM "StockItem" s
WHERE s.id = a."stockItemId" AND a.status = 'LOANED' AND a."currentHolderType" = 'OTHER'
  AND s."totalStock" - s."usedStock" - s."usedInRooms" < 1;

UPDATE "StockItem" s SET "usedStock" = "usedStock" + 1
FROM "SharedAsset" a
WHERE a."stockItemId" = s.id AND a.status = 'LOANED' AND a."currentHolderType" = 'OTHER'
  AND s."totalStock" - s."usedStock" - s."usedInRooms" >= 1;

UPDATE "SharedAsset"
SET "currentHolderType" = NULL, "currentEmployeeId" = NULL, "currentRoomId" = NULL,
    "currentPersonnelInventoryId" = NULL, "currentRoomInventoryId" = NULL,
    "borrowedAt" = NULL, "expectedReturnDate" = NULL
WHERE status <> 'LOANED';

UPDATE "SharedAssetLog" l
SET "returnedAt" = CURRENT_TIMESTAMP,
    notes = CONCAT(COALESCE(l.notes || ' / ', ''), 'Sistem bütünlük düzeltmesi: çakışan eski zimmet kapatıldı.')
FROM "SharedAsset" a
WHERE l."assetId" = a.id AND l.action = 'CHECK_OUT' AND l."returnedAt" IS NULL
  AND ((a."currentHolderType" = 'ROOM' AND COALESCE(l."roomId", '') <> COALESCE(a."currentRoomId", ''))
    OR (a."currentHolderType" = 'EMPLOYEE' AND COALESCE(l."employeeId", '') <> COALESCE(a."currentEmployeeId", ''))
    OR a.status <> 'LOANED');

WITH duplicate_open AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "assetId" ORDER BY "createdAt" DESC, id DESC) AS rn
  FROM "SharedAssetLog" WHERE action = 'CHECK_OUT' AND "returnedAt" IS NULL
)
UPDATE "SharedAssetLog" l SET "returnedAt" = CURRENT_TIMESTAMP,
  notes = CONCAT(COALESCE(l.notes || ' / ', ''), 'Sistem bütünlük düzeltmesi: eski açık zimmet kapatıldı.')
FROM duplicate_open d WHERE d.id = l.id AND d.rn > 1;

UPDATE "SharedAssetLog" SET "returnedAt" = "borrowedAt" WHERE "returnedAt" IS NOT NULL AND "returnedAt" < "borrowedAt";
UPDATE "SharedAssetLog" SET "expectedReturnDate" = "borrowedAt" WHERE "expectedReturnDate" IS NOT NULL AND "expectedReturnDate" < "borrowedAt";

UPDATE "StockItem" si SET "physicalStatus" = CASE
  WHEN sa.status = 'LOANED' THEN 'KULLANIMDA'
  WHEN sa.status = 'MAINTENANCE' THEN 'BAKIMDA'
  WHEN sa.status = 'RETIRED' THEN 'HURDA'
  ELSE 'KULLANILABİLİR' END
FROM "SharedAsset" sa WHERE sa."stockItemId" = si.id;

CREATE UNIQUE INDEX "SharedAsset_requestKey_key" ON "SharedAsset"("requestKey");
CREATE UNIQUE INDEX "SharedAsset_stockItemId_key" ON "SharedAsset"("stockItemId");
CREATE UNIQUE INDEX "SharedAsset_currentPersonnelInventoryId_key" ON "SharedAsset"("currentPersonnelInventoryId");
CREATE UNIQUE INDEX "SharedAsset_currentRoomInventoryId_key" ON "SharedAsset"("currentRoomInventoryId");
CREATE UNIQUE INDEX "SharedAsset_serialNo_active_key" ON "SharedAsset"(UPPER(BTRIM("serialNo"))) WHERE "serialNo" IS NOT NULL AND BTRIM("serialNo") <> '' AND status <> 'RETIRED';
CREATE INDEX "SharedAsset_createdById_createdAt_idx" ON "SharedAsset"("createdById", "createdAt");
CREATE UNIQUE INDEX "SharedAssetLog_requestKey_key" ON "SharedAssetLog"("requestKey");
CREATE UNIQUE INDEX "SharedAssetLog_one_open_checkout_key" ON "SharedAssetLog"("assetId") WHERE action = 'CHECK_OUT' AND "returnedAt" IS NULL;
CREATE INDEX "SharedAssetLog_action_createdAt_idx" ON "SharedAssetLog"(action, "createdAt");
CREATE INDEX "SharedAssetLog_employeeId_createdAt_idx" ON "SharedAssetLog"("employeeId", "createdAt");
CREATE INDEX "SharedAssetLog_roomId_createdAt_idx" ON "SharedAssetLog"("roomId", "createdAt");
CREATE INDEX "StockMovement_sharedAssetId_createdAt_idx" ON "StockMovement"("sharedAssetId", "createdAt");

ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_currentPersonnelInventoryId_fkey" FOREIGN KEY ("currentPersonnelInventoryId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_currentRoomInventoryId_fkey" FOREIGN KEY ("currentRoomInventoryId") REFERENCES "RoomInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sharedAssetId_fkey" FOREIGN KEY ("sharedAssetId") REFERENCES "SharedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_required_text_check" CHECK (LENGTH(BTRIM("assetCode")) > 0 AND LENGTH(BTRIM("assetName")) > 0 AND LENGTH(BTRIM("category")) > 0);
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_holder_state_check" CHECK (
  (status = 'LOANED' AND "borrowedAt" IS NOT NULL AND (
    ("currentHolderType" = 'EMPLOYEE' AND "currentEmployeeId" IS NOT NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NOT NULL AND "currentRoomInventoryId" IS NULL)
    OR ("currentHolderType" = 'ROOM' AND "currentRoomId" IS NOT NULL AND "currentEmployeeId" IS NULL AND "currentRoomInventoryId" IS NOT NULL AND "currentPersonnelInventoryId" IS NULL)
    OR ("currentHolderType" = 'OTHER' AND "currentEmployeeId" IS NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NULL AND "currentRoomInventoryId" IS NULL)
  ))
  OR (status <> 'LOANED' AND "currentHolderType" IS NULL AND "currentEmployeeId" IS NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NULL AND "currentRoomInventoryId" IS NULL AND "borrowedAt" IS NULL AND "expectedReturnDate" IS NULL)
);
ALTER TABLE "SharedAsset" ADD CONSTRAINT "SharedAsset_expected_return_check" CHECK ("expectedReturnDate" IS NULL OR ("borrowedAt" IS NOT NULL AND "expectedReturnDate" >= "borrowedAt"));
ALTER TABLE "SharedAssetLog" ADD CONSTRAINT "SharedAssetLog_action_check" CHECK (action IN ('CREATED','CHECK_OUT','CHECK_IN','MAINTENANCE_START','MAINTENANCE_END','FAULT_REPORTED','REPAIR_COMPLETED','STATUS_CHANGE','SYNC_CORRECTION'));
ALTER TABLE "SharedAssetLog" ADD CONSTRAINT "SharedAssetLog_required_snapshot_check" CHECK (LENGTH(BTRIM("assetCodeSnapshot")) > 0 AND LENGTH(BTRIM("assetNameSnapshot")) > 0);
ALTER TABLE "SharedAssetLog" ADD CONSTRAINT "SharedAssetLog_dates_check" CHECK (("returnedAt" IS NULL OR "returnedAt" >= "borrowedAt") AND ("expectedReturnDate" IS NULL OR "expectedReturnDate" >= "borrowedAt"));
