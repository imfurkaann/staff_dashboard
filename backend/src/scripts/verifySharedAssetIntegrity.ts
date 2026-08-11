import assert from 'node:assert/strict';
import prisma from '../db/prisma';

type CountRow = { issue: string; count: bigint };

async function main() {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT 'unlinkedCommonStock' AS issue, COUNT(*)::bigint AS count FROM "StockItem" s
      WHERE s."itemType" IN ('ORTAK_EKİPMAN','ORTAK_KULLANIM') AND NOT EXISTS (SELECT 1 FROM "SharedAsset" a WHERE a."stockItemId" = s.id)
    UNION ALL
    SELECT 'unlinkedSharedAsset', COUNT(*)::bigint FROM "SharedAsset" WHERE "stockItemId" IS NULL
    UNION ALL
    SELECT 'holderStateMismatch', COUNT(*)::bigint FROM "SharedAsset" WHERE NOT (
      (status = 'LOANED' AND "borrowedAt" IS NOT NULL AND (
        ("currentHolderType" = 'EMPLOYEE' AND "currentEmployeeId" IS NOT NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NOT NULL AND "currentRoomInventoryId" IS NULL)
        OR ("currentHolderType" = 'ROOM' AND "currentRoomId" IS NOT NULL AND "currentEmployeeId" IS NULL AND "currentRoomInventoryId" IS NOT NULL AND "currentPersonnelInventoryId" IS NULL)
        OR ("currentHolderType" = 'OTHER' AND "currentEmployeeId" IS NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NULL AND "currentRoomInventoryId" IS NULL)
      )) OR (status <> 'LOANED' AND "currentHolderType" IS NULL AND "currentEmployeeId" IS NULL AND "currentRoomId" IS NULL AND "currentPersonnelInventoryId" IS NULL AND "currentRoomInventoryId" IS NULL AND "borrowedAt" IS NULL AND "expectedReturnDate" IS NULL)
    )
    UNION ALL
    SELECT 'roomInventoryMismatch', COUNT(*)::bigint FROM "SharedAsset" a JOIN "RoomInventory" r ON r.id = a."currentRoomInventoryId"
      WHERE r."returnedAt" IS NOT NULL OR r."stockItemId" <> a."stockItemId" OR r."roomId" <> a."currentRoomId"
    UNION ALL
    SELECT 'personnelInventoryMismatch', COUNT(*)::bigint FROM "SharedAsset" a JOIN "InventoryItem" i ON i.id = a."currentPersonnelInventoryId"
      WHERE i."returnedDate" IS NOT NULL OR i."isDeleted" = TRUE OR i."stockItemId" <> a."stockItemId" OR i."employeeId" <> a."currentEmployeeId"
    UNION ALL
    SELECT 'multipleOpenCheckout', COUNT(*)::bigint FROM (SELECT "assetId" FROM "SharedAssetLog" WHERE action='CHECK_OUT' AND "returnedAt" IS NULL GROUP BY "assetId" HAVING COUNT(*) > 1) d
    UNION ALL
    SELECT 'activeCheckoutMismatch', COUNT(*)::bigint FROM "SharedAsset" a WHERE
      (a.status='LOANED' AND NOT EXISTS (SELECT 1 FROM "SharedAssetLog" l WHERE l."assetId"=a.id AND l.action='CHECK_OUT' AND l."returnedAt" IS NULL))
      OR (a.status<>'LOANED' AND EXISTS (SELECT 1 FROM "SharedAssetLog" l WHERE l."assetId"=a.id AND l.action='CHECK_OUT' AND l."returnedAt" IS NULL))
    UNION ALL
    SELECT 'stockPhysicalStatusMismatch', COUNT(*)::bigint FROM "SharedAsset" a JOIN "StockItem" s ON s.id=a."stockItemId" WHERE s."physicalStatus" <> CASE
      WHEN a.status='LOANED' THEN 'KULLANIMDA' WHEN a.status='MAINTENANCE' THEN 'BAKIMDA' WHEN a.status='RETIRED' THEN 'HURDA' ELSE 'KULLANILABİLİR' END
    UNION ALL
    SELECT 'movementAssetStockMismatch', COUNT(*)::bigint FROM "StockMovement" m JOIN "SharedAsset" a ON a.id=m."sharedAssetId" WHERE a."stockItemId" <> m."stockItemId"
    UNION ALL
    SELECT 'invalidExpectedReturn', COUNT(*)::bigint FROM "SharedAsset" WHERE "expectedReturnDate" IS NOT NULL AND ("borrowedAt" IS NULL OR "expectedReturnDate" < "borrowedAt")
    UNION ALL
    SELECT 'blankLogSnapshot', COUNT(*)::bigint FROM "SharedAssetLog" WHERE LENGTH(BTRIM("assetCodeSnapshot"))=0 OR LENGTH(BTRIM("assetNameSnapshot"))=0
    UNION ALL
    SELECT 'retiredWithPositiveStock', COUNT(*)::bigint FROM "SharedAsset" a JOIN "StockItem" s ON s.id=a."stockItemId" WHERE a.status='RETIRED' AND s."totalStock">0
    UNION ALL
    SELECT 'temporaryVerificationRows', COUNT(*)::bigint FROM "SharedAsset" WHERE "assetName" LIKE 'ZZ ORTAK EŞYA DOĞRULAMA%'
  `;
  const result = Object.fromEntries(rows.map((row) => [row.issue, Number(row.count)]));
  console.log(JSON.stringify({ checks: rows.length, result }));
  for (const count of Object.values(result)) assert.equal(count, 0);
  console.log(JSON.stringify({ success: true, checks: rows.length }));
  await prisma.$disconnect();
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
