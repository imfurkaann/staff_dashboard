import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { maintenanceService } from '../services/maintenanceService';
import { roomService } from '../services/roomService';
import { StockService } from '../services/stockService';

async function expectStatus(statusCode: number, run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => error instanceof AppError && error.statusCode === statusCode);
}

async function main() {
  if (process.env.ALLOW_MAINTENANCE_PRODUCTION_TEST !== '1') {
    throw new Error('Refusing to create temporary verification data without ALLOW_MAINTENANCE_PRODUCTION_TEST=1.');
  }

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let blockId: string | undefined;
  let roomId: string | undefined;
  let stockItemId: string | undefined;

  try {
    const actor = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true, fullName: true } });
    assert.ok(actor, 'At least one active user is required for audit attribution.');

    const block = await roomService.createBlock({ name: `ZZ-ARIZA-DOĞRULAMA-${suffix}`, genderPolicy: 'Mixed' });
    blockId = block.id;
    const room = await roomService.createRoom({ blockId, floor: 1, roomNumber: 'TEST-MNT', capacity: 1, roomType: 'PERSONEL_ODASI' });
    roomId = room.id;

    const requestKey = randomUUID();
    const general = await maintenanceService.createMaintenance({
      requestKey, roomId, type: 'GENERAL', description: 'YÜKSEK ÖNCELİKLİ TEKRAR GÖNDERİM TESTİ',
      priority: 'HIGH', reportedBy: actor.fullName, createdById: actor.id,
    });
    const repeated = await maintenanceService.createMaintenance({
      requestKey, roomId, type: 'GENERAL', description: 'YÜKSEK ÖNCELİKLİ TEKRAR GÖNDERİM TESTİ',
      priority: 'HIGH', reportedBy: actor.fullName, createdById: actor.id,
    });
    assert.equal(repeated.id, general.id, 'An idempotent retry must return the original maintenance record.');
    assert.equal(await prisma.maintenanceLog.count({ where: { requestKey } }), 1, 'An idempotent retry must not create a second record.');
    await expectStatus(409, () => maintenanceService.createMaintenance({
      requestKey, roomId: roomId!, type: 'GENERAL', description: 'AYNI ANAHTARLA FARKLI İSTEK',
      priority: 'LOW', reportedBy: actor.fullName, createdById: actor.id,
    }));
    assert.equal((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status, 'OUT_OF_ORDER');
    assert.equal(general.createdById, actor.id);
    assert.equal(general.events[0]?.performedById, actor.id);

    await assert.rejects(
      () => prisma.maintenanceLog.update({ where: { id: general.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } }),
      'Database constraints must reject resolution without a note and assignee.',
    );

    const stock = await StockService.createStockItem({
      itemName: `TEST KLİMA ${suffix}`, itemCode: `MNT-${suffix}`, category: 'ELEKTRONİK',
      itemType: 'DEMİRBAŞ', totalStock: 3, minimumStock: 0, createdById: actor.id,
    });
    stockItemId = stock.id;
    const firstAssignment = await StockService.assignToRoom(stock.id, {
      roomId, quantity: 1, brand: 'TEST', serialNo: `MNT-A-${suffix}`, notes: 'ARIZA DOĞRULAMA ZİMMETİ', createdById: actor.id,
    });

    const inventoryFault = await maintenanceService.createMaintenance({
      requestKey: randomUUID(), roomId, type: 'ROOM_INVENTORY', roomInventoryId: firstAssignment.id,
      inventoryStatus: 'IN_SERVICE', description: 'CİHAZ SERVİS SÜRECİ TESTİ', priority: 'MEDIUM',
      reportedBy: actor.fullName, createdById: actor.id,
    });
    assert.equal((await prisma.roomInventory.findUniqueOrThrow({ where: { id: firstAssignment.id } })).status, 'IN_SERVICE');
    await expectStatus(409, () => maintenanceService.createMaintenance({
      roomId: roomId!, type: 'ROOM_INVENTORY', roomInventoryId: firstAssignment.id,
      inventoryStatus: 'DAMAGED', description: 'İKİNCİ AKTİF ARIZA', reportedBy: actor.fullName, createdById: actor.id,
    }));

    const sentAt = new Date(Date.now() - 60_000);
    await maintenanceService.updateMaintenance(inventoryFault.id, {
      status: 'IN_PROGRESS', sentToServiceAt: sentAt, performedBy: actor.fullName, performedById: actor.id, canFullUpdate: true,
    });
    await expectStatus(400, () => maintenanceService.updateMaintenance(inventoryFault.id, {
      status: 'RESOLVED', resolutionNote: 'SERVİS TAMAMLADI', performedBy: actor.fullName, performedById: actor.id,
    }));
    const resolved = await maintenanceService.updateMaintenance(inventoryFault.id, {
      status: 'RESOLVED', resolutionNote: 'SERVİS TAMAMLADI', returnedFromServiceAt: new Date(),
      inventoryStatus: 'HEALTHY', performedBy: actor.fullName, performedById: actor.id, canFullUpdate: true,
    });
    assert.ok(resolved.resolvedAt);
    assert.equal((await prisma.roomInventory.findUniqueOrThrow({ where: { id: firstAssignment.id } })).status, 'HEALTHY');
    await expectStatus(403, () => maintenanceService.updateMaintenance(inventoryFault.id, {
      status: 'OPEN', performedBy: actor.fullName, performedById: actor.id, canFullUpdate: false,
    }));
    await maintenanceService.updateMaintenance(inventoryFault.id, {
      status: 'OPEN', priority: 'HIGH', performedBy: actor.fullName, performedById: actor.id, canFullUpdate: true,
    });
    assert.equal((await prisma.roomInventory.findUniqueOrThrow({ where: { id: firstAssignment.id } })).status, 'MAINTENANCE_REQUIRED');

    await maintenanceService.updateMaintenance(inventoryFault.id, {
      status: 'RESOLVED', resolutionNote: 'YENİDEN KONTROL EDİLDİ', inventoryStatus: 'HEALTHY',
      performedBy: actor.fullName, performedById: actor.id, canFullUpdate: true,
    });

    const secondAssignment = await StockService.assignToRoom(stock.id, {
      roomId, quantity: 1, brand: 'TEST', serialNo: `MNT-B-${suffix}`, notes: 'DEĞİŞİM DOĞRULAMA ZİMMETİ', createdById: actor.id,
    });
    const replacementFault = await maintenanceService.createMaintenance({
      requestKey: randomUUID(), roomId, type: 'ROOM_INVENTORY', roomInventoryId: secondAssignment.id,
      inventoryStatus: 'REPLACEMENT_REQUIRED', description: 'CİHAZ DEĞİŞİM SÜRECİ TESTİ',
      reportedBy: actor.fullName, createdById: actor.id,
    });
    const replacement = await StockService.replaceAssignment(secondAssignment.id, {
      brand: 'TEST-YENİ', serialNo: `MNT-C-${suffix}`, notes: 'ARIZALI CİHAZ YENİSİYLE DEĞİŞTİRİLDİ',
      createdById: actor.id, performedBy: actor.fullName,
    });
    assert.equal(replacement.status, 'HEALTHY');
    assert.equal((await prisma.roomInventory.findUniqueOrThrow({ where: { id: secondAssignment.id } })).status, 'RETIRED');
    assert.equal((await prisma.maintenanceLog.findUniqueOrThrow({ where: { id: replacementFault.id } })).status, 'RESOLVED');
    assert.equal(await prisma.stockMovement.count({ where: { maintenanceId: replacementFault.id, type: 'REPLACEMENT' } }), 1);

    console.log(JSON.stringify({ success: true, checks: 18 }));
  } finally {
    if (roomId) {
      const maintenanceIds = (await prisma.maintenanceLog.findMany({ where: { roomId }, select: { id: true } })).map((item) => item.id);
      if (maintenanceIds.length) await prisma.maintenanceEvent.deleteMany({ where: { maintenanceId: { in: maintenanceIds } } });
      if (stockItemId) await prisma.stockMovement.deleteMany({ where: { stockItemId } });
      else if (maintenanceIds.length) await prisma.stockMovement.deleteMany({ where: { maintenanceId: { in: maintenanceIds } } });
      if (maintenanceIds.length) await prisma.maintenanceLog.deleteMany({ where: { id: { in: maintenanceIds } } });
      await prisma.roomInventory.deleteMany({ where: { roomId } });
      await prisma.room.deleteMany({ where: { id: roomId } });
    }
    if (stockItemId) await prisma.stockItem.deleteMany({ where: { id: stockItemId } });
    if (blockId) await prisma.block.deleteMany({ where: { id: blockId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
