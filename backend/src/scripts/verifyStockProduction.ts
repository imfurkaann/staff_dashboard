import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { roomService } from '../services/roomService';
import { StockService } from '../services/stockService';

async function expectStatus(statusCode: number, run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => error instanceof AppError && error.statusCode === statusCode);
}

async function main() {
  if (process.env.ALLOW_STOCK_PRODUCTION_TEST !== '1') throw new Error('Refusing temporary stock verification without ALLOW_STOCK_PRODUCTION_TEST=1.');
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let blockId: string | undefined;
  const roomIds: string[] = [];
  const stockItemIds: string[] = [];

  try {
    const actor = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true, fullName: true } });
    assert.ok(actor, 'An active user is required for stock audit attribution.');
    const block = await roomService.createBlock({ name: `ZZ-STOK-DOĞRULAMA-${suffix}`, genderPolicy: 'Mixed' });
    blockId = block.id;
    for (const number of ['S-101', 'S-102']) {
      const room = await roomService.createRoom({ blockId, floor: 1, roomNumber: number, capacity: 1, roomType: 'PERSONEL_ODASI' });
      roomIds.push(room.id);
    }

    const createKey = randomUUID();
    const card = await StockService.createStockItem({
      requestKey: createKey, itemName: `ZZ STOK DOĞRULAMA DEMİRBAŞ ${suffix}`, itemCode: `ZZD-${suffix}`,
      category: 'ELEKTRONİK', itemType: 'DEMİRBAŞ', unit: 'ADET', totalStock: 2, minimumStock: 0, createdById: actor.id,
    });
    stockItemIds.push(card.id);
    const repeatedCard = await StockService.createStockItem({
      requestKey: createKey, itemName: `ZZ STOK DOĞRULAMA DEMİRBAŞ ${suffix}`, itemCode: `ZZD-${suffix}`,
      category: 'ELEKTRONİK', itemType: 'DEMİRBAŞ', unit: 'ADET', totalStock: 2, minimumStock: 0, createdById: actor.id,
    });
    assert.equal(repeatedCard.id, card.id);
    assert.equal(await prisma.stockMovement.count({ where: { stockItemId: card.id, type: 'OPENING' } }), 1);

    const receiveKey = randomUUID();
    await StockService.receive(card.id, { quantity: 2, reason: 'ÜRETİM DOĞRULAMA GİRİŞİ', notes: 'TEST BELGESİ', createdById: actor.id, requestKey: receiveKey });
    await StockService.receive(card.id, { quantity: 2, reason: 'ÜRETİM DOĞRULAMA GİRİŞİ', notes: 'TEST BELGESİ', createdById: actor.id, requestKey: receiveKey });
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: card.id } })).totalStock, 4);
    assert.equal(await prisma.stockMovement.count({ where: { requestKey: receiveKey } }), 1);

    const assignKey = randomUUID();
    const assignment = await StockService.assignToRoom(card.id, { roomId: roomIds[0], quantity: 1, brand: 'TEST', serialNo: `SER-${suffix}`, notes: 'TEST ZİMMETİ', createdById: actor.id, requestKey: assignKey });
    const repeatedAssignment = await StockService.assignToRoom(card.id, { roomId: roomIds[0], quantity: 1, brand: 'TEST', serialNo: `SER-${suffix}`, notes: 'TEST ZİMMETİ', createdById: actor.id, requestKey: assignKey });
    assert.equal(repeatedAssignment.id, assignment.id);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: card.id } })).usedInRooms, 1);

    await expectStatus(409, () => StockService.assignToRoom(card.id, { roomId: roomIds[1], quantity: 1, serialNo: `SER-${suffix}`, createdById: actor.id }));
    const transferKey = randomUUID();
    await StockService.transferRoom(assignment.id, { roomId: roomIds[1], notes: 'ODA DEĞİŞİKLİĞİ TESTİ', createdById: actor.id, requestKey: transferKey });
    await StockService.transferRoom(assignment.id, { roomId: roomIds[1], notes: 'ODA DEĞİŞİKLİĞİ TESTİ', createdById: actor.id, requestKey: transferKey });
    assert.equal((await prisma.roomInventory.findUniqueOrThrow({ where: { id: assignment.id } })).roomId, roomIds[1]);

    const identityKey = randomUUID();
    await StockService.updateAssignmentIdentity(assignment.id, { brand: 'TEST YENİ', serialNo: `SER-Y-${suffix}`, notes: 'ETİKET DOĞRULAMA', createdById: actor.id, requestKey: identityKey });
    await StockService.updateAssignmentIdentity(assignment.id, { brand: 'TEST YENİ', serialNo: `SER-Y-${suffix}`, notes: 'ETİKET DOĞRULAMA', createdById: actor.id, requestKey: identityKey });
    assert.equal(await prisma.stockMovement.count({ where: { requestKey: identityKey } }), 1);

    await expectStatus(400, () => StockService.reconcilePhysicalCount(card.id, { countedAvailable: 1, createdById: actor.id }));
    const countKey = randomUUID();
    const counted = await StockService.reconcilePhysicalCount(card.id, { countedAvailable: 2, notes: 'FİZİKSEL SAYIM DOĞRULAMASI', createdById: actor.id, requestKey: countKey });
    const repeatedCount = await StockService.reconcilePhysicalCount(card.id, { countedAvailable: 2, notes: 'FİZİKSEL SAYIM DOĞRULAMASI', createdById: actor.id, requestKey: countKey });
    assert.equal(repeatedCount.difference, counted.difference);

    const updateKey = randomUUID();
    await StockService.updateStockItem(card.id, { specifications: 'GÜNCELLENMİŞ TEST DETAYI', createdById: actor.id, requestKey: updateKey });
    await StockService.updateStockItem(card.id, { specifications: 'GÜNCELLENMİŞ TEST DETAYI', createdById: actor.id, requestKey: updateKey });
    assert.equal(await prisma.stockMovement.count({ where: { requestKey: updateKey, reason: 'STOK KARTI GÜNCELLEMESİ' } }), 1);
    await expectStatus(409, () => StockService.updateStockItem(card.id, { physicalStatus: 'HURDA', createdById: actor.id }));

    const history = await StockService.getMovements({ stockItemId: card.id, search: 'DOĞRULAMA', page: 1, pageSize: 100 });
    assert.ok(history.pagination.total >= 3);
    const receipts = await StockService.getMovements({ stockItemId: card.id, type: 'RECEIPT', page: 1, pageSize: 100 });
    assert.equal(receipts.pagination.total, 1);

    const returnKey = randomUUID();
    await StockService.returnFromRoom(assignment.id, { outcome: 'RETURNED', notes: 'SAĞLAM DEPO İADESİ', createdById: actor.id, requestKey: returnKey });
    await StockService.returnFromRoom(assignment.id, { outcome: 'RETURNED', notes: 'SAĞLAM DEPO İADESİ', createdById: actor.id, requestKey: returnKey });
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: card.id } })).usedInRooms, 0);

    await assert.rejects(() => prisma.stockItem.update({ where: { id: card.id }, data: { usedInRooms: 99 } }), 'Database balance constraints must reject impossible allocation.');
    console.log(JSON.stringify({ success: true, checks: 19 }));
  } finally {
    if (stockItemIds.length) {
      await prisma.stockMovement.deleteMany({ where: { stockItemId: { in: stockItemIds } } });
      await prisma.roomInventory.deleteMany({ where: { stockItemId: { in: stockItemIds } } });
      await prisma.inventoryItem.deleteMany({ where: { stockItemId: { in: stockItemIds } } });
      await prisma.stockItem.deleteMany({ where: { id: { in: stockItemIds } } });
    }
    if (roomIds.length) await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    if (blockId) await prisma.block.deleteMany({ where: { id: blockId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
