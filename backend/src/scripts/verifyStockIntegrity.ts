import assert from 'node:assert/strict';
import prisma from '../db/prisma';

type CountRow = { issue: string; count: bigint };

async function main() {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT 'invalidBalances' AS issue, COUNT(*)::bigint AS count FROM "StockItem"
      WHERE "totalStock" < 0 OR "usedStock" < 0 OR "usedInRooms" < 0 OR "usedStock" + "usedInRooms" > "totalStock" OR "minimumStock" < 0
    UNION ALL
    SELECT 'cachedRoomBalanceMismatch', COUNT(*)::bigint FROM "StockItem" s
      WHERE s."usedInRooms" <> COALESCE((SELECT SUM(r.quantity)::int FROM "RoomInventory" r WHERE r."stockItemId" = s.id AND r."returnedAt" IS NULL), 0)
    UNION ALL
    SELECT 'cachedPersonnelBalanceMismatch', COUNT(*)::bigint FROM "StockItem" s
      WHERE s."usedStock" <> COALESCE((SELECT COUNT(*)::int FROM "InventoryItem" i WHERE i."stockItemId" = s.id AND i."returnedDate" IS NULL AND i."isDeleted" = false), 0)
        + COALESCE((SELECT COUNT(*)::int FROM "SharedAsset" a WHERE a."stockItemId" = s.id AND a.status = 'LOANED' AND a."currentHolderType" = 'OTHER'), 0)
    UNION ALL
    SELECT 'roomReturnStateMismatch', COUNT(*)::bigint FROM "RoomInventory"
      WHERE ("returnedAt" IS NULL AND status IN ('RETIRED','LOST')) OR ("returnedAt" IS NOT NULL AND status NOT IN ('RETIRED','LOST'))
    UNION ALL
    SELECT 'activeRoomSerialDuplicate', COUNT(*)::bigint FROM (
      SELECT "serialNo" FROM "RoomInventory" WHERE "returnedAt" IS NULL AND "serialNo" IS NOT NULL GROUP BY "serialNo" HAVING COUNT(*) > 1
    ) duplicates
    UNION ALL
    SELECT 'crossAssignmentSerialDuplicate', COUNT(*)::bigint FROM "RoomInventory" r
      JOIN "InventoryItem" i ON i."serialNo" = r."serialNo"
      WHERE r."returnedAt" IS NULL AND i."returnedDate" IS NULL AND i."isDeleted" = false AND r."serialNo" IS NOT NULL
    UNION ALL
    SELECT 'movementRoomInventoryStockMismatch', COUNT(*)::bigint FROM "StockMovement" m
      JOIN "RoomInventory" r ON r.id = m."roomInventoryId" WHERE r."stockItemId" <> m."stockItemId"
    UNION ALL
    SELECT 'movementPersonnelStockMismatch', COUNT(*)::bigint FROM "StockMovement" m
      JOIN "InventoryItem" i ON i.id = m."personnelInventoryId" WHERE i."stockItemId" IS NOT NULL AND i."stockItemId" <> m."stockItemId"
    UNION ALL
    SELECT 'roomAssignmentWithoutLedger', COUNT(*)::bigint FROM "RoomInventory" r
      WHERE NOT EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."roomInventoryId" = r.id AND m.type IN ('ROOM_ASSIGNMENT','REPLACEMENT'))
    UNION ALL
    SELECT 'personnelAssignmentWithoutLedger', COUNT(*)::bigint FROM "InventoryItem" i
      WHERE i."stockItemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."personnelInventoryId" = i.id AND m.type = 'PERSONNEL_ASSIGNMENT')
    UNION ALL
    SELECT 'invalidMovementQuantity', COUNT(*)::bigint FROM "StockMovement"
      WHERE NOT (
        (type = 'OPENING' AND quantity >= 0)
        OR (type IN ('RECEIPT','ROOM_RETURN','PERSONNEL_RETURN') AND quantity > 0)
        OR (type IN ('ROOM_ASSIGNMENT','PERSONNEL_ASSIGNMENT','REPLACEMENT','RETIREMENT') AND quantity < 0)
        OR (type IN ('STATUS_CHANGE','ROOM_TRANSFER') AND quantity = 0)
        OR type = 'ADJUSTMENT'
      )
    UNION ALL
    SELECT 'blankMovementSnapshot', COUNT(*)::bigint FROM "StockMovement" WHERE LENGTH(BTRIM("itemNameSnapshot")) = 0
    UNION ALL
    SELECT 'stockLedgerTotalMismatch', COUNT(*)::bigint FROM "StockItem" s
      WHERE s."totalStock" <> COALESCE((SELECT SUM(m.quantity)::int FROM "StockMovement" m WHERE m."stockItemId" = s.id AND m.type IN ('OPENING','RECEIPT','ADJUSTMENT','RETIREMENT','REPLACEMENT')), 0)
    UNION ALL
    SELECT 'temporaryVerificationRows', COUNT(*)::bigint FROM "StockItem" WHERE "itemName" LIKE 'ZZ STOK DOĞRULAMA%'
  `;
  const result = Object.fromEntries(rows.map((row) => [row.issue, Number(row.count)]));
  for (const count of Object.values(result)) assert.equal(count, 0);
  console.log(JSON.stringify({ success: true, checks: rows.length, result }));
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
