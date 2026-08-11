import assert from 'node:assert/strict';
import prisma from '../db/prisma';
import { roomService } from '../services/roomService';
import { maintenanceService } from '../services/maintenanceService';
import { EmployeeService } from '../services/employeeService';
import { AppError } from '../middleware/errorHandler';

async function expectConflict(run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => error instanceof AppError && error.statusCode === 409);
}

async function main() {
  if (process.env.ALLOW_ROOM_PRODUCTION_TEST !== '1') throw new Error('Refusing to create temporary verification data without ALLOW_ROOM_PRODUCTION_TEST=1.');
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const blockName = `ZZ-ODA-DOĞRULAMA-${suffix}`;
  let blockId: string | undefined;
  let roomId: string | undefined;
  let employeeId: string | undefined;

  try {
    const actor = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true, fullName: true } });
    assert.ok(actor, 'At least one active user is required for audit attribution.');

    const block = await roomService.createBlock({ name: blockName, genderPolicy: 'Mixed' });
    blockId = block.id;
    const createdRoom = await roomService.createRoom({ blockId, floor: 1, roomNumber: 'TEST-101', capacity: 2, roomType: 'PERSONEL_ODASI' });
    roomId = createdRoom.id;

    await roomService.updateRoom(roomId, { capacity: 3 });
    assert.equal(await prisma.bed.count({ where: { roomId } }), 3, 'Capacity expansion must create exactly one bed per capacity unit.');

    const fault = await maintenanceService.createMaintenance({
      roomId, type: 'GENERAL', title: 'GÜVENLİK TEST ARIZASI', description: 'YÜKSEK ÖNCELİKLİ CANLI DOĞRULAMA',
      priority: 'HIGH', reportedBy: actor.fullName, createdById: actor.id,
    });
    assert.equal((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status, 'OUT_OF_ORDER', 'High-priority fault must take the room out of service.');
    await expectConflict(() => roomService.updateRoomStatus(roomId!, 'READY', actor.fullName));
    await maintenanceService.updateMaintenance(fault.id, { status: 'RESOLVED', resolutionNote: 'TEST KONTROLÜ TAMAMLANDI', performedBy: actor.fullName });
    await roomService.updateRoomStatus(roomId, 'READY', actor.fullName);

    await roomService.createCleaningLog(roomId, { status: 'NEEDS_CLEANING', requestedBy: actor.fullName });
    await expectConflict(() => roomService.createCleaningLog(roomId!, { status: 'IN_PROGRESS', requestedBy: actor.fullName }));
    const openCleaning = await prisma.roomCleaningLog.findFirstOrThrow({ where: { roomId, isDeleted: false, status: { not: 'CLEANED' } } });
    await roomService.updateCleaningLog(openCleaning.id, { status: 'CLEANED', cleanedBy: actor.fullName });
    await roomService.deleteCleaningLog(openCleaning.id, actor.id);
    assert.equal((await prisma.roomCleaningLog.findUniqueOrThrow({ where: { id: openCleaning.id } })).isDeleted, true, 'Completed cleaning history must be archived, not erased.');

    await roomService.updateRoomStatus(roomId, 'OUT_OF_ORDER', actor.fullName);
    await roomService.createCleaningLog(roomId, { status: 'CLEANED', requestedBy: actor.fullName, cleanedBy: actor.fullName });
    assert.equal((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status, 'OUT_OF_ORDER', 'Cleaning completion must not make an out-of-order room ready.');
    const completedCleaning = await prisma.roomCleaningLog.findFirstOrThrow({ where: { roomId, isDeleted: false, status: 'CLEANED' } });
    await roomService.deleteCleaningLog(completedCleaning.id, actor.id);
    await roomService.updateRoomStatus(roomId, 'READY', actor.fullName);

    const employee = await prisma.employee.create({ data: {
      firstName: 'ODA', lastName: 'DOĞRULAMA', gender: 'Male', department: 'TEKNİK SERVİS', status: 'PENDING_ASSIGNMENT', createdById: actor.id,
    } });
    employeeId = employee.id;
    const bed = await prisma.bed.findFirstOrThrow({ where: { roomId, isOccupied: false } });
    await EmployeeService.updateEmployee(employee.id, { bedId: bed.id, createdById: actor.id });
    await expectConflict(() => EmployeeService.updateEmployee(employee.id, { bedId: bed.id, createdById: actor.id }));
    assert.equal(await prisma.occupancyLog.count({ where: { employeeId: employee.id, checkOutDate: null } }), 1, 'Same-bed rejection must not create false history.');
    await EmployeeService.checkoutEmployeeFromRoom(employee.id, actor.id);
    assert.equal(await prisma.occupancyLog.count({ where: { employeeId: employee.id, checkOutDate: null } }), 0, 'Checkout must close active occupancy.');
    assert.equal(await prisma.occupancyLog.count({ where: { employeeId: employee.id, checkOutDate: { not: null } } }), 1, 'Checkout must preserve one historical occupancy.');
    assert.equal((await prisma.bed.findUniqueOrThrow({ where: { id: bed.id } })).isOccupied, false, 'Checkout must release the bed.');

    await assert.rejects(
      () => prisma.bed.update({ where: { id: bed.id }, data: { isOccupied: true, currentEmployeeId: null } }),
      'Database constraint must reject an occupied bed without an employee.',
    );

    console.log(JSON.stringify({ success: true, checks: 12 }));
  } finally {
    if (employeeId) {
      await prisma.occupancyLog.deleteMany({ where: { employeeId } });
      await prisma.bed.updateMany({ where: { currentEmployeeId: employeeId }, data: { isOccupied: false, currentEmployeeId: null } });
      await prisma.employee.deleteMany({ where: { id: employeeId } });
    }
    if (roomId) {
      const maintenanceIds = (await prisma.maintenanceLog.findMany({ where: { roomId }, select: { id: true } })).map((item) => item.id);
      if (maintenanceIds.length) {
        await prisma.maintenanceEvent.deleteMany({ where: { maintenanceId: { in: maintenanceIds } } });
        await prisma.stockMovement.deleteMany({ where: { maintenanceId: { in: maintenanceIds } } });
        await prisma.maintenanceLog.deleteMany({ where: { id: { in: maintenanceIds } } });
      }
      await prisma.roomCleaningLog.deleteMany({ where: { roomId } });
      await prisma.room.deleteMany({ where: { id: roomId } });
    }
    if (blockId) await prisma.block.deleteMany({ where: { id: blockId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
