import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import prisma from '../db/prisma';
import { SharedAssetService } from '../services/sharedAssetService';
import { StockService } from '../services/stockService';

async function main() {
  if (process.env.ALLOW_SHARED_ASSET_PRODUCTION_TEST !== '1') throw new Error('ALLOW_SHARED_ASSET_PRODUCTION_TEST=1 gereklidir.');
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  const block = await prisma.block.create({ data: { name: `ZZ ORTAK ${suffix}`, genderPolicy: 'Mixed' } });
  const room1 = await prisma.room.create({ data: { blockId: block.id, roomNumber: `Z${suffix}1`, floor: 0, capacity: 1 } });
  const room2 = await prisma.room.create({ data: { blockId: block.id, roomNumber: `Z${suffix}2`, floor: 0, capacity: 1 } });
  const employee = await prisma.employee.create({ data: { registrationNo: `ZZOA${suffix}`, firstName: 'ZZ ORTAK', lastName: 'DOĞRULAMA', gender: 'Male', department: 'TEST', status: 'RESIDENT' } });
  const actor = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
  const ids: { stock?: string; asset?: string } = {};
  let checks = 0;
  try {
    const createKey = crypto.randomUUID();
    const stock = await StockService.createStockItem({ itemName: `ZZ ORTAK EŞYA DOĞRULAMA ${suffix}`, itemCode: `ZZOA-${suffix}`, category: 'GENEL EŞYALAR', itemType: 'ORTAK_EKİPMAN', totalStock: 1, minimumStock: 0, createdById: actor?.id, requestKey: createKey });
    ids.stock = stock.id;
    const asset = await prisma.sharedAsset.findUniqueOrThrow({ where: { stockItemId: stock.id } });
    ids.asset = asset.id;
    assert.equal(asset.status, 'AVAILABLE'); checks++;
    const repeatedStock = await StockService.createStockItem({ itemName: `ZZ ORTAK EŞYA DOĞRULAMA ${suffix}`, itemCode: `ZZOA-${suffix}`, category: 'GENEL EŞYALAR', itemType: 'ORTAK_EKİPMAN', totalStock: 1, minimumStock: 0, createdById: actor?.id, requestKey: createKey });
    assert.equal(repeatedStock.id, stock.id); checks++;
    await assert.rejects(() => StockService.receive(stock.id, { quantity: 1, reason: 'TEST', createdById: actor?.id })); checks++;

    const employeeKey = crypto.randomUUID();
    const employeeLoan = await SharedAssetService.checkOutAsset(asset.id, { holderType: 'EMPLOYEE', employeeId: employee.id, expectedReturnDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), notes: 'PERSONEL ZİMMET TESTİ', createdById: actor?.id, requestKey: employeeKey });
    assert.equal(employeeLoan.currentEmployeeId, employee.id); checks++;
    const employeeReplay = await SharedAssetService.checkOutAsset(asset.id, { holderType: 'EMPLOYEE', employeeId: employee.id, notes: 'PERSONEL ZİMMET TESTİ', createdById: actor?.id, requestKey: employeeKey });
    assert.equal(employeeReplay.id, asset.id); checks++;
    const stockOnLoan = await prisma.stockItem.findUniqueOrThrow({ where: { id: stock.id } });
    assert.equal(stockOnLoan.usedStock, 1); checks++;
    await assert.rejects(() => SharedAssetService.addMaintenanceLog(asset.id, { action: 'FAULT_REPORTED', notes: 'ZİMMETLİYKEN ARIZA TESTİ', createdById: actor?.id })); checks++;

    const checkInKey = crypto.randomUUID();
    await SharedAssetService.checkInAsset(asset.id, { notes: 'SAĞLAM İADE TESTİ', locationNote: 'ANA DEPO', createdById: actor?.id, requestKey: checkInKey });
    await SharedAssetService.checkInAsset(asset.id, { notes: 'SAĞLAM İADE TESTİ', locationNote: 'ANA DEPO', createdById: actor?.id, requestKey: checkInKey });
    const stockReturned = await prisma.stockItem.findUniqueOrThrow({ where: { id: stock.id } });
    assert.equal(stockReturned.usedStock, 0); checks++;

    const roomKey = crypto.randomUUID();
    const roomLoan = await SharedAssetService.checkOutAsset(asset.id, { holderType: 'ROOM', roomId: room1.id, notes: 'ODA ZİMMET TESTİ', createdById: actor?.id, requestKey: roomKey });
    assert.equal(roomLoan.currentRoomId, room1.id); checks++;
    const roomInventoryId = roomLoan.currentRoomInventoryId!;
    await StockService.transferRoom(roomInventoryId, { roomId: room2.id, notes: 'ODA TRANSFER TESTİ', createdById: actor?.id, requestKey: crypto.randomUUID() });
    const transferred = await prisma.sharedAsset.findUniqueOrThrow({ where: { id: asset.id } });
    assert.equal(transferred.currentRoomId, room2.id); checks++;
    await StockService.returnFromRoom(roomInventoryId, { outcome: 'RETURNED', notes: 'ODA İADE TESTİ', createdById: actor?.id, requestKey: crypto.randomUUID() });
    assert.equal((await prisma.sharedAsset.findUniqueOrThrow({ where: { id: asset.id } })).status, 'AVAILABLE'); checks++;

    const faultKey = crypto.randomUUID();
    await SharedAssetService.addMaintenanceLog(asset.id, { action: 'FAULT_REPORTED', notes: 'MOTOR SESİ KONTROL TESTİ', createdById: actor?.id, requestKey: faultKey });
    await SharedAssetService.addMaintenanceLog(asset.id, { action: 'FAULT_REPORTED', notes: 'MOTOR SESİ KONTROL TESTİ', createdById: actor?.id, requestKey: faultKey });
    assert.equal((await prisma.sharedAsset.findUniqueOrThrow({ where: { id: asset.id } })).status, 'MAINTENANCE'); checks++;
    await SharedAssetService.addMaintenanceLog(asset.id, { action: 'REPAIR_COMPLETED', notes: 'MOTOR KONTROL EDİLDİ TEST', createdById: actor?.id, requestKey: crypto.randomUUID() });
    assert.equal((await prisma.sharedAsset.findUniqueOrThrow({ where: { id: asset.id } })).status, 'AVAILABLE'); checks++;
    const filtered = await SharedAssetService.getLogs({ assetId: asset.id, action: 'CHECK_OUT', page: 1, pageSize: 50 });
    assert.equal(filtered.pagination.total, 2); checks++;
    const publicOverview = await SharedAssetService.getOverview(false);
    assert.equal(publicOverview.employees.length, 0); checks++;
    assert.equal(publicOverview.rooms.length, 0); checks++;
    const retireKey = crypto.randomUUID();
    await SharedAssetService.updateAssetStatus(asset.id, { status: 'RETIRED', notes: 'EKONOMİK ÖMÜR TESTİ', createdById: actor?.id, requestKey: retireKey });
    const retiredReplay = await SharedAssetService.updateAssetStatus(asset.id, { status: 'RETIRED', notes: 'EKONOMİK ÖMÜR TESTİ', createdById: actor?.id, requestKey: retireKey });
    assert.equal(retiredReplay.status, 'RETIRED'); checks++;
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: stock.id } })).totalStock, 0); checks++;
    console.log(JSON.stringify({ success: true, checks }));
  } finally {
    if (ids.stock) {
      await prisma.stockMovement.deleteMany({ where: { stockItemId: ids.stock } });
      await prisma.sharedAssetLog.deleteMany({ where: { asset: { stockItemId: ids.stock } } });
      await prisma.sharedAsset.deleteMany({ where: { stockItemId: ids.stock } });
      await prisma.roomInventory.deleteMany({ where: { stockItemId: ids.stock } });
      await prisma.inventoryItem.deleteMany({ where: { stockItemId: ids.stock } });
      await prisma.stockItem.deleteMany({ where: { id: ids.stock } });
    }
    await prisma.employee.delete({ where: { id: employee.id } });
    await prisma.room.deleteMany({ where: { blockId: block.id } });
    await prisma.block.delete({ where: { id: block.id } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
