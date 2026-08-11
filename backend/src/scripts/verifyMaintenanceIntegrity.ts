import assert from 'node:assert/strict';
import prisma from '../db/prisma';

type CountRow = { issue: string; count: bigint };

async function main() {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT 'statusResolvedMismatch' AS issue, COUNT(*)::bigint AS count FROM "MaintenanceLog"
      WHERE ("status" IN ('OPEN','IN_PROGRESS') AND "resolvedAt" IS NOT NULL)
         OR ("status" IN ('RESOLVED','CLOSED') AND "resolvedAt" IS NULL)
    UNION ALL
    SELECT 'closedWithoutResolution', COUNT(*)::bigint FROM "MaintenanceLog"
      WHERE "status" IN ('RESOLVED','CLOSED') AND ("resolutionNote" IS NULL OR LENGTH(BTRIM("resolutionNote")) = 0)
    UNION ALL
    SELECT 'closedWithoutAssignee', COUNT(*)::bigint FROM "MaintenanceLog"
      WHERE "status" IN ('RESOLVED','CLOSED') AND ("assignedTo" IS NULL OR LENGTH(BTRIM("assignedTo")) = 0)
    UNION ALL
    SELECT 'inventoryRoomMismatch', COUNT(*)::bigint FROM "MaintenanceLog" m
      JOIN "RoomInventory" i ON i.id = m."roomInventoryId" WHERE i."roomId" <> m."roomId"
    UNION ALL
    SELECT 'activeFaultHealthyDevice', COUNT(*)::bigint FROM "MaintenanceLog" m
      JOIN "RoomInventory" i ON i.id = m."roomInventoryId"
      WHERE m."status" IN ('OPEN','IN_PROGRESS') AND i.status = 'HEALTHY'
    UNION ALL
    SELECT 'activeFaultReturnedDevice', COUNT(*)::bigint FROM "MaintenanceLog" m
      JOIN "RoomInventory" i ON i.id = m."roomInventoryId"
      WHERE m."status" IN ('OPEN','IN_PROGRESS') AND i."returnedAt" IS NOT NULL
    UNION ALL
    SELECT 'missingInitialEvent', COUNT(*)::bigint FROM "MaintenanceLog" m
      WHERE NOT EXISTS (SELECT 1 FROM "MaintenanceEvent" e WHERE e."maintenanceId" = m.id AND e.action = 'FAULT_REPORTED')
    UNION ALL
    SELECT 'closedServiceWithoutReturn', COUNT(*)::bigint FROM "MaintenanceLog"
      WHERE "status" IN ('RESOLVED','CLOSED') AND "sentToServiceAt" IS NOT NULL AND "returnedFromServiceAt" IS NULL
    UNION ALL
    SELECT 'serviceDateMismatch', COUNT(*)::bigint FROM "MaintenanceLog"
      WHERE "returnedFromServiceAt" IS NOT NULL AND ("sentToServiceAt" IS NULL OR "returnedFromServiceAt" < "sentToServiceAt")
    UNION ALL
    SELECT 'activeHighRoomNotOutOfOrder', COUNT(*)::bigint FROM "MaintenanceLog" m
      JOIN "Room" r ON r.id = m."roomId"
      WHERE m."status" IN ('OPEN','IN_PROGRESS') AND m.priority IN ('HIGH','URGENT') AND r.status <> 'OUT_OF_ORDER'
    UNION ALL
    SELECT 'maintenanceMovementRoomMismatch', COUNT(*)::bigint FROM "StockMovement" s
      JOIN "MaintenanceLog" m ON m.id = s."maintenanceId"
      WHERE s."roomId" IS NOT NULL AND s."roomId" <> m."roomId"
    UNION ALL
    SELECT 'duplicateActiveInventoryFault', COUNT(*)::bigint FROM (
      SELECT "roomInventoryId" FROM "MaintenanceLog"
      WHERE "roomInventoryId" IS NOT NULL AND "status" IN ('OPEN','IN_PROGRESS')
      GROUP BY "roomInventoryId" HAVING COUNT(*) > 1
    ) duplicate_faults
    UNION ALL
    SELECT 'temporaryVerificationRows', COUNT(*)::bigint FROM "Block" WHERE name LIKE 'ZZ-ARIZA-DOĞRULAMA-%'
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
