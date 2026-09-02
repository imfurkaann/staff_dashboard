import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const categoryPrefixes: Record<string, string> = {
  'TEMİZLİK & BAKIM MAKİNELERİ': 'MAK', 'EL ALETLERİ & TAMİR': 'ALT', 'BAHÇE & PEYZAJ': 'BHC',
  'ELEKTRİKLİ EV ALETLERİ': 'ELK', 'GÜVENLİK & İŞ SAĞLIĞI': 'GVN', 'MOBİLYA & MEFRUŞAT': 'MOB',
  'ELEKTRONİK & BİLİŞİM': 'ELT', 'ISITMA & SOĞUTMA': 'IKL', 'MUTFAK & SERVİS EKİPMANLARI': 'MTF',
  'ÖLÇÜM & TEST CİHAZLARI': 'TST', 'MERDİVEN & İSKELE': 'MRD', 'TAŞIMA & DEPOLAMA': 'TSM',
  'GENEL EŞYALAR': 'ORT', GENEL: 'ORT', 'BEYAZ EŞYA': 'BEY',
};

async function findAvailableSharedAsset(
  tx: Prisma.TransactionClient,
  stockItemId: string,
) {
  let asset = await tx.sharedAsset.findFirst({
    where: {
      stockItemId,
      status: 'AVAILABLE',
      currentRoomId: null,
      OR: [
        { locationNote: null },
        { locationNote: 'ANA DEPO' },
        { locationNote: 'Ana Depo' },
      ],
    },
  });

  if (asset) return asset;

  return tx.sharedAsset.findFirst({
    where: { stockItemId, status: 'AVAILABLE' },
  });
}

export async function syncSharedAssetRoomAssignment(
  tx: Prisma.TransactionClient, stockItemId: string, roomInventoryId: string, roomId: string,
  borrowedAt: Date, actorId?: string, requestKey?: string,
): Promise<string | null> {
  const asset = await findAvailableSharedAsset(tx, stockItemId);
  if (!asset) return null;
  if (asset.status !== 'AVAILABLE') throw new AppError('Bu stok kartına bağlı kullanılabilir ortak eşya bulunamadı.', 409);
  const room = await tx.room.findUnique({ where: { id: roomId }, include: { block: true } });
  if (!room) throw new AppError('Ortak eşya için hedef oda bulunamadı.', 404);
  if (room.roomType && room.roomType !== 'PERSONEL_ODASI') {
    const locName = `${room.block.name} / Oda ${room.roomNumber}`;
    await tx.sharedAsset.update({ where: { id: asset.id }, data: { locationNote: locName } });
    await tx.sharedAssetLog.create({ data: {
      requestKey: requestKey || null, assetId: asset.id, action: 'STATUS_CHANGE', assetCodeSnapshot: asset.assetCode,
      assetNameSnapshot: asset.assetName, holderType: 'ROOM', statusFrom: asset.status, statusTo: 'AVAILABLE',
      borrowerName: locName, roomId: room.id, notes: `Konumu ${locName} hizmet odası olarak güncellendi.`, createdById: actorId || null,
    } });
    return asset.id;
  }
  const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, status: 'AVAILABLE', updatedAt: asset.updatedAt }, data: {
    status: 'LOANED', currentHolderType: 'ROOM', currentRoomId: room.id, currentEmployeeId: null,
    currentRoomInventoryId: roomInventoryId, currentPersonnelInventoryId: null, borrowedAt, expectedReturnDate: null,
  } });
  if (changed.count !== 1) throw new AppError('Bağlı ortak eşya başka bir işlemde değişti.', 409);
  await tx.sharedAssetLog.create({ data: {
    requestKey: requestKey || null, assetId: asset.id, action: 'CHECK_OUT', assetCodeSnapshot: asset.assetCode,
    assetNameSnapshot: asset.assetName, holderType: 'ROOM', statusFrom: 'AVAILABLE', statusTo: 'LOANED',
    borrowerName: `${room.block.name} / Oda ${room.roomNumber}`, roomId: room.id, borrowedAt,
    notes: 'Depo/stok oda zimmetiyle otomatik eşitlendi.', createdById: actorId || null,
  } });
  return asset.id;
}

export async function syncSharedAssetPersonnelAssignment(
  tx: Prisma.TransactionClient, stockItemId: string, personnelInventoryId: string, employeeId: string,
  borrowedAt: Date, actorId?: string, requestKey?: string,
): Promise<string | null> {
  const asset = await findAvailableSharedAsset(tx, stockItemId);
  if (!asset) return null;
  if (asset.status !== 'AVAILABLE') throw new AppError('Bu stok kartına bağlı kullanılabilir ortak eşya bulunamadı.', 409);
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError('Ortak eşya için personel bulunamadı.', 404);
  const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, status: 'AVAILABLE', updatedAt: asset.updatedAt }, data: {
    status: 'LOANED', currentHolderType: 'EMPLOYEE', currentEmployeeId: employee.id, currentRoomId: null,
    currentPersonnelInventoryId: personnelInventoryId, currentRoomInventoryId: null, borrowedAt, expectedReturnDate: null,
  } });
  if (changed.count !== 1) throw new AppError('Bağlı ortak eşya başka bir işlemde değişti.', 409);
  await tx.sharedAssetLog.create({ data: {
    requestKey: requestKey || null, assetId: asset.id, action: 'CHECK_OUT', assetCodeSnapshot: asset.assetCode,
    assetNameSnapshot: asset.assetName, holderType: 'EMPLOYEE', statusFrom: 'AVAILABLE', statusTo: 'LOANED',
    borrowerName: `${employee.firstName} ${employee.lastName}`, employeeId: employee.id, borrowedAt,
    notes: 'Personel zimmetiyle otomatik eşitlendi.', createdById: actorId || null,
  } });
  return asset.id;
}

export async function syncSharedAssetReturn(
  tx: Prisma.TransactionClient, stockItemId: string, assignmentKind: 'ROOM' | 'EMPLOYEE', assignmentId: string,
  targetStatus: 'AVAILABLE' | 'RETIRED', notes: string, actorId?: string, requestKey?: string,
): Promise<string | null> {
  const asset = await tx.sharedAsset.findFirst({
    where: {
      stockItemId,
      OR: [
        { currentRoomInventoryId: assignmentId },
        { currentPersonnelInventoryId: assignmentId },
      ],
    },
  });
  if (!asset) return null;
  const returnedAt = new Date();
  const activeLog = await tx.sharedAssetLog.findFirst({ where: { assetId: asset.id, action: 'CHECK_OUT', returnedAt: null }, orderBy: { createdAt: 'desc' } });
  if (activeLog) {
    await tx.sharedAssetLog.update({ where: { id: activeLog.id }, data: { returnedAt } });
  }
  await tx.sharedAsset.update({
    where: { id: asset.id },
    data: {
      status: targetStatus, currentHolderType: null, currentEmployeeId: null, currentRoomId: null,
      currentPersonnelInventoryId: null, currentRoomInventoryId: null, borrowedAt: null, expectedReturnDate: null,
      locationNote: 'ANA DEPO',
    },
  });
  await tx.stockItem.update({ where: { id: stockItemId }, data: { physicalStatus: targetStatus === 'RETIRED' ? 'HURDA' : 'KULLANILABİLİR' } });
  await tx.sharedAssetLog.create({ data: {
    requestKey: requestKey || null, assetId: asset.id, action: 'CHECK_IN', assetCodeSnapshot: asset.assetCode,
    assetNameSnapshot: asset.assetName, holderType: asset.currentHolderType, statusFrom: asset.status, statusTo: targetStatus,
    borrowerName: activeLog?.borrowerName || 'DEPO', employeeId: asset.currentEmployeeId, roomId: asset.currentRoomId,
    borrowedAt: asset.borrowedAt || activeLog?.borrowedAt, returnedAt, notes, createdById: actorId || null,
  } });
  return asset.id;
}

export async function syncSharedAssetRoomTransfer(
  tx: Prisma.TransactionClient, stockItemId: string, roomInventoryId: string, roomId: string,
  notes: string, actorId?: string, requestKey?: string,
): Promise<string | null> {
  const asset = await tx.sharedAsset.findFirst({
    where: {
      stockItemId,
      OR: [
        { currentRoomInventoryId: roomInventoryId },
        { status: 'AVAILABLE' },
      ],
    },
  });
  if (!asset) return null;
  const room = await tx.room.findUnique({ where: { id: roomId }, include: { block: true } });
  if (!room) throw new AppError('Hedef oda bulunamadı.', 404);
  const newLocName = `${room.block.name} / Oda ${room.roomNumber}`;
  await tx.sharedAsset.update({
    where: { id: asset.id },
    data: {
      currentRoomId: room.roomType === 'PERSONEL_ODASI' ? room.id : null,
      locationNote: newLocName,
    },
  });
  await tx.sharedAssetLog.create({ data: {
    requestKey: requestKey || null, assetId: asset.id, action: 'STATUS_CHANGE', assetCodeSnapshot: asset.assetCode,
    assetNameSnapshot: asset.assetName, holderType: 'ROOM', statusFrom: asset.status, statusTo: asset.status,
    borrowerName: newLocName, roomId: room.id, notes, createdById: actorId || null,
  } });
  return asset.id;
}

export async function syncSharedAssetIdentity(
  tx: Prisma.TransactionClient, stockItemId: string, serialNo: string | null, brandModel: string | null,
  notes: string, actorId?: string,
): Promise<string | null> {
  const asset = await tx.sharedAsset.findFirst({ where: { stockItemId } });
  if (!asset) return null;
  await tx.sharedAsset.update({ where: { id: asset.id }, data: { serialNo, brandModel } });
  await tx.sharedAssetLog.create({ data: {
    assetId: asset.id, action: 'STATUS_CHANGE', assetCodeSnapshot: asset.assetCode, assetNameSnapshot: asset.assetName,
    statusFrom: asset.status, statusTo: asset.status, notes, createdById: actorId || null,
  } });
  return asset.id;
}

export async function syncSharedAssetReplacement(
  tx: Prisma.TransactionClient, stockItemId: string, oldRoomInventoryId: string, newRoomInventoryId: string,
  serialNo: string | null, brandModel: string | null, notes: string, actorId?: string, requestKey?: string,
): Promise<string | null> {
  const asset = await tx.sharedAsset.findFirst({ where: { stockItemId } });
  if (!asset) return null;
  if (asset.status !== 'LOANED' || asset.currentRoomInventoryId !== oldRoomInventoryId) throw new AppError('Bağlı ortak eşya cihaz değişimiyle uyuşmuyor.', 409);
  const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, updatedAt: asset.updatedAt }, data: {
    currentRoomInventoryId: newRoomInventoryId, serialNo, brandModel,
  } });
  if (changed.count !== 1) throw new AppError('Bağlı ortak eşya başka bir işlemde değişti.', 409);
  await tx.sharedAssetLog.create({ data: {
    requestKey: requestKey || null, assetId: asset.id, action: 'STATUS_CHANGE', assetCodeSnapshot: asset.assetCode,
    assetNameSnapshot: asset.assetName, holderType: 'ROOM', statusFrom: 'LOANED', statusTo: 'LOANED',
    borrowerName: null, roomId: asset.currentRoomId, notes, createdById: actorId || null,
  } });
  return asset.id;
}
