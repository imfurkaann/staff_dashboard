import assert from 'node:assert/strict';
import prisma from '../db/prisma';
import { EmployeeService } from '../services/employeeService';
import { roomService } from '../services/roomService';
import { AppError } from '../middleware/errorHandler';

async function expectConflict(run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => error instanceof AppError && error.statusCode === 409);
}

async function main() {
  if (process.env.ALLOW_EMPLOYEE_PRODUCTION_TEST !== '1') throw new Error('Refusing to create temporary verification data without ALLOW_EMPLOYEE_PRODUCTION_TEST=1.');
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const serial = `EMP-VERIFY-${suffix}`.toLocaleUpperCase('tr-TR');
  let employeeId: string | undefined;
  let generatedUserId: string | undefined;
  let blockId: string | undefined;
  let roomId: string | undefined;
  const stockItemIds: string[] = [];

  try {
    const actor = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
    assert.ok(actor, 'An active actor is required for audit attribution.');

    const employee = await EmployeeService.createEmployee({
      firstName: 'PERSONEL', lastName: `DOĞRULAMA ${suffix}`, gender: 'Male',
      department: 'BİLGİ İŞLEM / IT', registrationNo: `VERIFY-${suffix}`, createdById: actor.id,
    });
    employeeId = employee.id;
    assert.equal(employee.userId, null, 'Employee creation without an explicit account request must not create a user.');

    const credentials = await EmployeeService.generateAccountForEmployee(employee.id, actor.id);
    assert.equal(credentials.role, 'STAFF');
    const linked = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id }, include: { user: true } });
    assert.ok(linked.userId && linked.user);
    generatedUserId = linked.userId;
    assert.equal(linked.user.role, 'STAFF');
    assert.equal(await prisma.userAuditLog.count({ where: { targetUserId: linked.userId, action: 'EMPLOYEE_PORTAL_ACCOUNT_GENERATED' } }), 1);

    const block = await roomService.createBlock({ name: `ZZ-PERSONEL-DOĞRULAMA-${suffix}`, genderPolicy: 'Mixed' });
    blockId = block.id;
    const room = await roomService.createRoom({ blockId, floor: 1, roomNumber: 'TEST-PERSONEL', capacity: 1, roomType: 'PERSONEL_ODASI' });
    roomId = room.id;
    const bed = await prisma.bed.findFirstOrThrow({ where: { roomId: room.id } });
    await EmployeeService.updateEmployee(employee.id, { bedId: bed.id, createdById: actor.id });

    const visitor = await prisma.visitor.create({ data: {
      fullName: 'GEÇİCİ DOĞRULAMA ZİYARETÇİSİ', hostEmployeeId: employee.id,
      hostEmployeeName: 'PERSONEL DOĞRULAMA', hostRoomLabel: 'TEST-PERSONEL', purpose: 'DOĞRULAMA', createdById: actor.id,
    } });
    await expectConflict(() => EmployeeService.checkoutEmployeeFromRoom(employee.id, actor.id));
    await prisma.visitor.update({ where: { id: visitor.id }, data: { status: 'EXITED', exitTime: new Date(), updatedById: actor.id } });
    await EmployeeService.checkoutEmployeeFromRoom(employee.id, actor.id);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: linked.userId! } })).isActive, false);

    await EmployeeService.updateEmployee(employee.id, { bedId: bed.id, createdById: actor.id });
    const reactivated = await prisma.employee.findUniqueOrThrow({ where: { id: employee.id }, include: { user: true } });
    assert.equal(reactivated.status, 'RESIDENT');
    assert.equal(reactivated.checkedOutById, null);
    assert.equal(reactivated.user?.isActive, true);

    const personal = await EmployeeService.addInventoryItem(employee.id, {
      itemName: 'ŞAHSİ TEST CİHAZI', category: 'ŞAHSİ_EŞYA', serialNo: `${serial}-PERSONAL`, createdById: actor.id,
    });
    await expectConflict(() => EmployeeService.addInventoryItem(employee.id, {
      itemName: 'İKİNCİ ŞAHSİ TEST CİHAZI', category: 'ŞAHSİ_EŞYA', serialNo: `${serial}-PERSONAL`, createdById: actor.id,
    }));
    await EmployeeService.deleteInventoryItem(personal.id, actor.id);
    assert.equal((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: personal.id } })).isDeleted, true);

    const note = await EmployeeService.addDisciplinaryNote(employee.id, { title: 'DOĞRULAMA NOTU', content: 'GEÇİCİ TEST KAYDI', createdById: actor.id });
    await EmployeeService.deleteDisciplinaryNote(note.id, actor.id);
    assert.equal((await prisma.disciplinaryNote.findUniqueOrThrow({ where: { id: note.id } })).isDeleted, true);

    const personnelStock = await prisma.stockItem.create({ data: {
      itemName: `ZZ PERSONEL TEST STOK ${suffix}`, itemCode: `P-${suffix}`, itemType: 'DEMİRBAŞ', totalStock: 1,
    } });
    stockItemIds.push(personnelStock.id);
    const roomStock = await prisma.stockItem.create({ data: {
      itemName: `ZZ ODA TEST STOK ${suffix}`, itemCode: `R-${suffix}`, itemType: 'DEMİRBAŞ', totalStock: 1,
    } });
    stockItemIds.push(roomStock.id);
    const assignment = await EmployeeService.addInventoryItem(employee.id, {
      itemName: personnelStock.itemName, category: 'LOJMAN_ZİMMETİ', stockItemId: personnelStock.id,
      serialNo: serial, createdById: actor.id,
    });
    await expectConflict(() => roomService.createRoomInventory(room.id, {
      itemName: roomStock.itemName, stockItemId: roomStock.id, serialNo: serial, createdById: actor.id,
    }));
    await expectConflict(() => EmployeeService.checkoutEmployeeFromRoom(employee.id, actor.id));
    await EmployeeService.returnInventoryItem(assignment.id, actor.id, 'TAM_İADE_ALINDI', 'ÜRETİM DOĞRULAMA İADESİ');
    await EmployeeService.checkoutEmployeeFromRoom(employee.id, actor.id);
    assert.equal(await prisma.occupancyLog.count({ where: { employeeId: employee.id, checkOutDate: null } }), 0);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: linked.userId! } })).isActive, false);

    await assert.rejects(() => prisma.inventoryItem.create({ data: {
      employeeId: employee.id, itemName: 'GEÇERSİZ DURUM TESTİ', category: 'ŞAHSİ_EŞYA', status: 'TAM_İADE_ALINDI',
    } }), 'Database return-state constraint must reject a returned status without a return date.');

    console.log(JSON.stringify({ success: true, checks: 18 }));
  } finally {
    if (employeeId) {
      await prisma.visitor.deleteMany({ where: { hostEmployeeId: employeeId } });
      await prisma.stockMovement.deleteMany({ where: { employeeId } });
      await prisma.inventoryItem.deleteMany({ where: { employeeId } });
      await prisma.disciplinaryNote.deleteMany({ where: { employeeId } });
      await prisma.occupancyLog.deleteMany({ where: { employeeId } });
      await prisma.bed.updateMany({ where: { currentEmployeeId: employeeId }, data: { currentEmployeeId: null, isOccupied: false } });
      await prisma.employee.deleteMany({ where: { id: employeeId } });
    }
    if (generatedUserId) {
      await prisma.userAuditLog.deleteMany({ where: { targetUserId: generatedUserId } });
      await prisma.user.deleteMany({ where: { id: generatedUserId } });
    }
    if (roomId) await prisma.room.deleteMany({ where: { id: roomId } });
    if (blockId) await prisma.block.deleteMany({ where: { id: blockId } });
    if (stockItemIds.length) await prisma.stockItem.deleteMany({ where: { id: { in: stockItemIds } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
