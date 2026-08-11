import { Prisma, SharedAssetStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { boundedText, normalizeIdentifier, normalizeInventoryItemName, normalizeUpper } from '../utils/normalization';
import { releasePersonnelStock, releaseRoomStock, reservePersonnelStock, reserveRoomStock } from '../utils/stockBalance';

const categories = new Set([
  'TEMİZLİK & BAKIM MAKİNELERİ', 'EL ALETLERİ & TAMİR', 'BAHÇE & PEYZAJ',
  'ELEKTRİKLİ EV ALETLERİ', 'GÜVENLİK & İŞ SAĞLIĞI', 'MOBİLYA & MEFRUŞAT',
  'ELEKTRONİK & BİLİŞİM', 'ISITMA & SOĞUTMA', 'MUTFAK & SERVİS EKİPMANLARI',
  'ÖLÇÜM & TEST CİHAZLARI', 'MERDİVEN & İSKELE', 'TAŞIMA & DEPOLAMA',
  'GENEL EŞYALAR', 'GENEL', 'BEYAZ EŞYA', 'ODA DEMİRBAŞI',
]);

const categoryPrefixes: Record<string, string> = {
  'TEMİZLİK & BAKIM MAKİNELERİ': 'MAK', 'EL ALETLERİ & TAMİR': 'ALT', 'BAHÇE & PEYZAJ': 'BHC',
  'ELEKTRİKLİ EV ALETLERİ': 'ELK', 'GÜVENLİK & İŞ SAĞLIĞI': 'GVN', 'MOBİLYA & MEFRUŞAT': 'MOB',
  'ELEKTRONİK & BİLİŞİM': 'ELT', 'ISITMA & SOĞUTMA': 'IKL', 'MUTFAK & SERVİS EKİPMANLARI': 'MTF',
  'ÖLÇÜM & TEST CİHAZLARI': 'TST', 'MERDİVEN & İSKELE': 'MRD', 'TAŞIMA & DEPOLAMA': 'TSM',
  'GENEL EŞYALAR': 'ORT', GENEL: 'ORT',
};

const assetInclude = {
  stockItem: { select: { id: true, itemCode: true, itemName: true, totalStock: true, usedStock: true, usedInRooms: true, isActive: true, physicalStatus: true } },
  currentEmployee: { select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true } },
  currentRoom: { select: { id: true, roomNumber: true, floor: true, block: { select: { name: true } } } },
  logs: { orderBy: { createdAt: 'desc' as const }, take: 20, include: { createdBy: { select: { id: true, fullName: true } } } },
};

function dateOnly(value: unknown, label: string, endOfDay = true): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new AppError(`${label} geçersiz.`, 400);
    return value;
  }
  if (typeof value !== 'string') throw new AppError(`${label} geçersiz.`, 400);
  return parseIstanbulDateBoundary(value, endOfDay) || null;
}

function code(value: unknown): string | null {
  const result = boundedText(value, 'Ortak eşya kodu', 40, { casing: 'upper' });
  if (result && !/^[A-Z0-9ÇĞİÖŞÜ._/-]+$/u.test(result)) throw new AppError('Ortak eşya kodu yalnızca harf, rakam, nokta, alt çizgi, eğik çizgi ve tire içerebilir.', 400);
  return result;
}

function activeBorrowerName(asset: any): string {
  if (asset.currentEmployee) return `${asset.currentEmployee.firstName} ${asset.currentEmployee.lastName}`;
  if (asset.currentRoom) return `${asset.currentRoom.block.name} / Oda ${asset.currentRoom.roomNumber}`;
  return 'Harici kullanıcı';
}

async function idempotentLog(tx: Prisma.TransactionClient, requestKey: string | undefined, assetId: string, action: string, actorId?: string) {
  if (!requestKey) return null;
  const prior = await tx.sharedAssetLog.findUnique({ where: { requestKey } });
  if (!prior) return null;
  if (prior.assetId !== assetId || prior.action !== action || (prior.createdById || null) !== (actorId || null)) {
    throw new AppError('Tekrar-gönderim anahtarı farklı bir ortak eşya işleminde kullanılmış.', 409);
  }
  return tx.sharedAsset.findUniqueOrThrow({ where: { id: assetId }, include: assetInclude });
}

export class SharedAssetService {
  private static async generateNextAssetCode(tx: Prisma.TransactionClient, category: string): Promise<string> {
    const prefix = categoryPrefixes[category] || 'ORT';
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`SHARED_ASSET_CODE:${prefix}`}))`;
    const rows = await tx.sharedAsset.findMany({ where: { assetCode: { startsWith: `${prefix}-` } }, select: { assetCode: true } });
    const max = rows.reduce((current, row) => {
      const match = row.assetCode.match(new RegExp(`^${prefix}-(\\d+)$`));
      const parsed = match ? Number(match[1]) : 0;
      return Number.isSafeInteger(parsed) && parsed > current ? parsed : current;
    }, 0);
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }

  public static async getOverview(canManage = false) {
    const [assets, employees, rooms] = await Promise.all([
      canManage
        ? prisma.sharedAsset.findMany({ include: assetInclude, orderBy: [{ status: 'asc' }, { assetName: 'asc' }], take: 5000 })
        : prisma.sharedAsset.findMany({ select: {
          id: true, assetCode: true, assetName: true, category: true, brandModel: true,
          status: true, warrantyEndDate: true, createdAt: true, updatedAt: true,
        }, orderBy: [{ status: 'asc' }, { assetName: 'asc' }], take: 5000 }),
      canManage ? prisma.employee.findMany({
        where: { isDeleted: false, status: { not: 'CHECKED_OUT' } },
        select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }) : Promise.resolve([]),
      canManage ? prisma.room.findMany({
        include: { block: true }, orderBy: [{ block: { name: 'asc' } }, { roomNumber: 'asc' }],
      }) : Promise.resolve([]),
    ]);
    const summary = {
      totalRegistered: assets.length,
      available: assets.filter((asset) => asset.status === 'AVAILABLE').length,
      loaned: assets.filter((asset) => asset.status === 'LOANED').length,
      maintenance: assets.filter((asset) => asset.status === 'MAINTENANCE').length,
      retired: assets.filter((asset) => asset.status === 'RETIRED').length,
    };
    return { assets, employees, rooms, summary };
  }

  public static async getLogs(filters: {
    search?: string; assetId?: string; action?: string; holderType?: string;
    dateStart?: string; dateEnd?: string; page?: number; pageSize?: number;
  }) {
    const search = boundedText(filters.search, 'Arama filtresi', 120, { casing: 'preserve' });
    const action = boundedText(filters.action, 'İşlem türü filtresi', 40, { casing: 'upper' });
    const holderType = boundedText(filters.holderType, 'Zimmet türü filtresi', 20, { casing: 'upper' });
    const allowedActions = ['CREATED','CHECK_OUT','CHECK_IN','MAINTENANCE_START','MAINTENANCE_END','FAULT_REPORTED','REPAIR_COMPLETED','STATUS_CHANGE','SYNC_CORRECTION'];
    if (action && !allowedActions.includes(action)) throw new AppError('Geçersiz ortak eşya işlem türü.', 400);
    if (holderType && !['EMPLOYEE', 'ROOM', 'OTHER'].includes(holderType)) throw new AppError('Geçersiz zimmet türü.', 400);
    const start = parseIstanbulDateBoundary(filters.dateStart, false);
    const end = parseIstanbulDateBoundary(filters.dateEnd, true);
    assertDateRange(start, end);
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 50, 100);
    const where: Prisma.SharedAssetLogWhereInput = {
      ...(filters.assetId && { assetId: filters.assetId }),
      ...(action && { action }), ...(holderType && { holderType }),
      ...((start || end) && { createdAt: { ...(start && { gte: start }), ...(end && { lte: end }) } }),
      ...(search && { OR: [
        { assetCodeSnapshot: { contains: search, mode: 'insensitive' } },
        { assetNameSnapshot: { contains: search, mode: 'insensitive' } },
        { borrowerName: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { createdBy: { fullName: { contains: search, mode: 'insensitive' } } },
      ] }),
    };
    const [items, total] = await Promise.all([
      prisma.sharedAssetLog.findMany({ where, include: {
        asset: { select: { id: true, assetCode: true, assetName: true, status: true } },
        createdBy: { select: { id: true, fullName: true } },
      }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.sharedAssetLog.count({ where }),
    ]);
    return { items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  public static async createAsset(data: {
    stockItemId?: string; assetName?: string; assetCode?: string; category?: string; brandModel?: string;
    serialNo?: string; warrantyEndDate?: string | Date; locationNote?: string; notes?: string;
    createdById?: string; requestKey?: string;
  }) {
    if (!data.stockItemId) throw new AppError('Ortak eşya kaydı bir depo stok kartına bağlı olmalıdır.', 400);
    try {
      return await prisma.$transaction(async (tx) => {
        if (data.requestKey) {
          const prior = await tx.sharedAsset.findUnique({ where: { requestKey: data.requestKey }, include: assetInclude });
          if (prior) {
            if (prior.stockItemId !== data.stockItemId || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir ortak eşya işleminde kullanılmış.', 409);
            return prior;
          }
        }
        const stock = await tx.stockItem.findUnique({ where: { id: data.stockItemId } });
        if (!stock || !stock.isActive || !['ORTAK_EKİPMAN', 'ORTAK_KULLANIM'].includes(stock.itemType)) throw new AppError('Aktif ortak kullanım stok kartı bulunamadı.', 404);
        const linked = await tx.sharedAsset.findUnique({ where: { stockItemId: stock.id } });
        if (linked) throw new AppError('Bu stok kartı zaten bir ortak eşya kaydına bağlı.', 409);
        const assetName = normalizeInventoryItemName(boundedText(data.assetName ?? stock.itemName, 'Ortak eşya adı', 120, { required: true, casing: 'upper' }))!;
        const category = normalizeUpper(data.category ?? stock.category) || 'GENEL EŞYALAR';
        if (!categories.has(category)) throw new AppError('Geçersiz ortak eşya kategorisi.', 400);
        const assetCode = code(data.assetCode ?? stock.itemCode) || await this.generateNextAssetCode(tx, category);
        const serialNo = normalizeIdentifier(data.serialNo);
        const warrantyEndDate = data.warrantyEndDate === undefined ? stock.warrantyEndDate : dateOnly(data.warrantyEndDate, 'Garanti bitiş tarihi');
        const asset = await tx.sharedAsset.create({ data: {
          requestKey: data.requestKey || null, stockItemId: stock.id, createdById: data.createdById || null,
          assetName, assetCode, category, serialNo,
          brandModel: boundedText(data.brandModel ?? stock.specifications, 'Marka / model', 150, { casing: 'upper' }),
          warrantyEndDate, locationNote: boundedText(data.locationNote ?? stock.locationNote, 'Konum', 200, { casing: 'upper' }) || 'ANA DEPO',
          notes: boundedText(data.notes, 'Açıklama', 1000, { casing: 'upper' }), status: 'AVAILABLE',
        } });
        await tx.sharedAssetLog.create({ data: {
          assetId: asset.id, action: 'CREATED', assetCodeSnapshot: asset.assetCode, assetNameSnapshot: asset.assetName,
          statusTo: 'AVAILABLE', notes: 'Ortak eşya stok kartına bağlı olarak oluşturuldu.', createdById: data.createdById || null,
        } });
        return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Aynı kod, seri numarası veya stok bağlantısıyla kayıtlı ortak eşya bulunuyor.', 409);
      if (error?.code === 'P2034') throw new AppError('Ortak eşya aynı anda değiştirildi. Listeyi yenileyip tekrar deneyin.', 409);
      throw error;
    }
  }

  public static async checkOutAsset(assetId: string, data: {
    holderType?: 'EMPLOYEE' | 'ROOM' | 'OTHER'; employeeId?: string; customBorrowerName?: string;
    roomId?: string; expectedReturnDate?: string; notes?: string; createdById?: string; requestKey?: string;
  }) {
    const holderType = data.holderType || (data.roomId ? 'ROOM' : data.employeeId ? 'EMPLOYEE' : 'OTHER');
    if (!['EMPLOYEE', 'ROOM', 'OTHER'].includes(holderType)) throw new AppError('Geçersiz zimmet hedefi.', 400);
    const notes = boundedText(data.notes, 'Zimmet açıklaması', 1000, { casing: 'upper' });
    const expectedReturnDate = dateOnly(data.expectedReturnDate, 'Beklenen iade tarihi');
    if (expectedReturnDate && expectedReturnDate < new Date()) throw new AppError('Beklenen iade tarihi geçmiş bir tarih olamaz.', 400);
    try {
      return await prisma.$transaction(async (tx) => {
        const replay = await idempotentLog(tx, data.requestKey, assetId, 'CHECK_OUT', data.createdById);
        if (replay) return replay;
        await tx.$queryRaw`SELECT id FROM "SharedAsset" WHERE id = ${assetId} FOR UPDATE`;
        const asset = await tx.sharedAsset.findUnique({ where: { id: assetId }, include: { stockItem: true } });
        if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);
        if (asset.status !== 'AVAILABLE') throw new AppError('Yalnızca depoda ve müsait durumdaki eşya zimmetlenebilir.', 409);
        if (!asset.stockItem || !asset.stockItem.isActive || asset.stockItem.physicalStatus === 'HURDA') throw new AppError('Ortak eşyanın aktif stok kartı bulunamadı.', 409);

        let employeeId: string | null = null;
        let roomId: string | null = null;
        let personnelInventoryId: string | null = null;
        let roomInventoryId: string | null = null;
        let borrowerName: string;
        const identity = asset.serialNo || asset.assetCode;
        if (holderType === 'EMPLOYEE') {
          if (!data.employeeId) throw new AppError('Personel zimmeti için personel seçilmelidir.', 400);
          const employee = await tx.employee.findFirst({ where: { id: data.employeeId, isDeleted: false, status: { not: 'CHECKED_OUT' } } });
          if (!employee) throw new AppError('Aktif personel bulunamadı.', 404);
          await reservePersonnelStock(tx, asset.stockItem.id);
          const inventory = await tx.inventoryItem.create({ data: {
            employeeId: employee.id, stockItemId: asset.stockItem.id, itemName: asset.assetName, itemCode: asset.assetCode,
            category: 'LOJMAN_ZİMMETİ', status: 'TESLİM_EDİLDİ', serialNo: identity, notes,
            createdById: data.createdById || null,
          } });
          employeeId = employee.id; personnelInventoryId = inventory.id;
          borrowerName = `${employee.firstName} ${employee.lastName}${employee.department ? ` (${employee.department})` : ''}`;
          await tx.stockMovement.create({ data: {
            stockItemId: asset.stockItem.id, sharedAssetId: asset.id, employeeId, personnelInventoryId,
            type: 'PERSONNEL_ASSIGNMENT', quantity: -1, itemNameSnapshot: asset.assetName, serialNo: identity,
            reason: 'ORTAK EŞYA PERSONEL ZİMMETİ', notes, createdById: data.createdById || null,
          } });
        } else if (holderType === 'ROOM') {
          if (!data.roomId) throw new AppError('Oda zimmeti için oda seçilmelidir.', 400);
          const room = await tx.room.findUnique({ where: { id: data.roomId }, include: { block: true } });
          if (!room) throw new AppError('Oda bulunamadı.', 404);
          await reserveRoomStock(tx, asset.stockItem.id, 1);
          let inventory = await tx.roomInventory.create({ data: {
            roomId: room.id, stockItemId: asset.stockItem.id, itemName: asset.assetName, brand: asset.brandModel,
            serialNo: identity, quantity: 1, status: 'HEALTHY', notes,
          } });
          inventory = await tx.roomInventory.update({ where: { id: inventory.id }, data: { assetTag: `${asset.assetCode}-${inventory.id.replace(/-/g, '').slice(0, 10).toUpperCase()}` } });
          roomId = room.id; roomInventoryId = inventory.id;
          borrowerName = `${room.block.name} / Oda ${room.roomNumber}`;
          await tx.stockMovement.create({ data: {
            stockItemId: asset.stockItem.id, sharedAssetId: asset.id, roomId, roomInventoryId,
            type: 'ROOM_ASSIGNMENT', quantity: -1, itemNameSnapshot: asset.assetName,
            roomLabelSnapshot: borrowerName, brand: asset.brandModel, serialNo: identity,
            reason: 'ORTAK EŞYA ODA ZİMMETİ', notes, createdById: data.createdById || null,
          } });
        } else {
          borrowerName = boundedText(data.customBorrowerName, 'Teslim alan kişi/kurum', 120, { required: true, casing: 'upper' })!;
          await reservePersonnelStock(tx, asset.stockItem.id);
          await tx.stockMovement.create({ data: {
            stockItemId: asset.stockItem.id, sharedAssetId: asset.id, type: 'PERSONNEL_ASSIGNMENT', quantity: -1,
            itemNameSnapshot: asset.assetName, serialNo: identity, reason: 'ORTAK EŞYA HARİCİ ZİMMETİ', notes,
            createdById: data.createdById || null,
          } });
        }
        const borrowedAt = new Date();
        const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, status: 'AVAILABLE', updatedAt: asset.updatedAt }, data: {
          status: 'LOANED', currentHolderType: holderType, currentEmployeeId: employeeId, currentRoomId: roomId,
          currentPersonnelInventoryId: personnelInventoryId, currentRoomInventoryId: roomInventoryId,
          borrowedAt, expectedReturnDate,
        } });
        if (changed.count !== 1) throw new AppError('Ortak eşya başka bir işlemde değişti. Listeyi yenileyin.', 409);
        await tx.stockItem.update({ where: { id: asset.stockItem.id }, data: { physicalStatus: 'KULLANIMDA' } });
        await tx.sharedAssetLog.create({ data: {
          requestKey: data.requestKey || null, assetId: asset.id, action: 'CHECK_OUT', assetCodeSnapshot: asset.assetCode,
          assetNameSnapshot: asset.assetName, holderType, statusFrom: 'AVAILABLE', statusTo: 'LOANED', borrowerName,
          employeeId, roomId, borrowedAt, expectedReturnDate, notes, createdById: data.createdById || null,
        } });
        return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Eşya kodu/seri numarası veya işlem anahtarı başka bir aktif kayıtta kullanılıyor.', 409);
      if (error?.code === 'P2034') throw new AppError('Ortak eşya aynı anda değiştirildi. Listeyi yenileyip tekrar deneyin.', 409);
      throw error;
    }
  }

  public static async checkInAsset(assetId: string, data: {
    locationNote?: string; notes?: string; createdById?: string; newStatus?: SharedAssetStatus; requestKey?: string;
  }) {
    const targetStatus = data.newStatus || 'AVAILABLE';
    if (!['AVAILABLE', 'MAINTENANCE'].includes(targetStatus)) throw new AppError('Teslim alma sonucu yalnızca depoda veya bakımda olabilir.', 400);
    const notes = boundedText(data.notes, 'Teslim açıklaması', 1000, { required: true, casing: 'upper' })!;
    const locationNote = boundedText(data.locationNote, 'Teslim konumu', 200, { casing: 'upper' });
    return prisma.$transaction(async (tx) => {
      const replay = await idempotentLog(tx, data.requestKey, assetId, 'CHECK_IN', data.createdById);
      if (replay) return replay;
      await tx.$queryRaw`SELECT id FROM "SharedAsset" WHERE id = ${assetId} FOR UPDATE`;
      const asset = await tx.sharedAsset.findUnique({ where: { id: assetId }, include: {
        stockItem: true, currentEmployee: true, currentRoom: { include: { block: true } },
      } });
      if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);
      if (asset.status !== 'LOANED' || !asset.stockItem) throw new AppError('Yalnızca aktif zimmetli ortak eşya teslim alınabilir.', 409);
      const borrowerName = activeBorrowerName(asset);
      const returnedAt = new Date();
      if (asset.currentPersonnelInventoryId) {
        const inventory = await tx.inventoryItem.findUnique({ where: { id: asset.currentPersonnelInventoryId } });
        if (!inventory || inventory.returnedDate) throw new AppError('Personel zimmeti ile ortak eşya kaydı uyuşmuyor.', 409);
        await releasePersonnelStock(tx, asset.stockItem.id);
        const changed = await tx.inventoryItem.updateMany({ where: { id: inventory.id, returnedDate: null, isDeleted: false, updatedAt: inventory.updatedAt }, data: {
          returnedDate: returnedAt, returnedById: data.createdById || null, status: 'TAM_İADE_ALINDI', notes,
        } });
        if (changed.count !== 1) throw new AppError('Personel zimmeti başka bir işlemde kapatıldı.', 409);
        await tx.stockMovement.create({ data: {
          stockItemId: asset.stockItem.id, sharedAssetId: asset.id, employeeId: asset.currentEmployeeId,
          personnelInventoryId: inventory.id, type: 'PERSONNEL_RETURN', quantity: 1,
          itemNameSnapshot: asset.assetName, serialNo: asset.serialNo || asset.assetCode,
          reason: 'ORTAK EŞYA TESLİM ALMA', notes, createdById: data.createdById || null,
        } });
      } else if (asset.currentRoomInventoryId) {
        const inventory = await tx.roomInventory.findUnique({ where: { id: asset.currentRoomInventoryId } });
        if (!inventory || inventory.returnedAt) throw new AppError('Oda zimmeti ile ortak eşya kaydı uyuşmuyor.', 409);
        await releaseRoomStock(tx, asset.stockItem.id, 1);
        const changed = await tx.roomInventory.updateMany({ where: { id: inventory.id, returnedAt: null, updatedAt: inventory.updatedAt }, data: {
          returnedAt, status: 'RETIRED', notes,
        } });
        if (changed.count !== 1) throw new AppError('Oda zimmeti başka bir işlemde kapatıldı.', 409);
        await tx.stockMovement.create({ data: {
          stockItemId: asset.stockItem.id, sharedAssetId: asset.id, roomId: asset.currentRoomId,
          roomInventoryId: inventory.id, type: 'ROOM_RETURN', quantity: 1,
          itemNameSnapshot: asset.assetName, serialNo: asset.serialNo || asset.assetCode,
          reason: 'ORTAK EŞYA TESLİM ALMA', notes, createdById: data.createdById || null,
        } });
      } else if (asset.currentHolderType === 'OTHER') {
        await releasePersonnelStock(tx, asset.stockItem.id);
        await tx.stockMovement.create({ data: {
          stockItemId: asset.stockItem.id, sharedAssetId: asset.id, type: 'PERSONNEL_RETURN', quantity: 1,
          itemNameSnapshot: asset.assetName, serialNo: asset.serialNo || asset.assetCode,
          reason: 'ORTAK EŞYA HARİCİ İADE', notes, createdById: data.createdById || null,
        } });
      } else throw new AppError('Aktif zimmet bağlantısı bulunamadı. İşlem durduruldu.', 409);

      const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, status: 'LOANED', updatedAt: asset.updatedAt }, data: {
        status: targetStatus, currentHolderType: null, currentEmployeeId: null, currentRoomId: null,
        currentPersonnelInventoryId: null, currentRoomInventoryId: null, borrowedAt: null, expectedReturnDate: null,
        locationNote: locationNote || asset.locationNote || 'ANA DEPO',
      } });
      if (changed.count !== 1) throw new AppError('Ortak eşya başka bir işlemde değişti. Listeyi yenileyin.', 409);
      await tx.stockItem.update({ where: { id: asset.stockItem.id }, data: { physicalStatus: targetStatus === 'MAINTENANCE' ? 'BAKIMDA' : 'KULLANILABİLİR' } });
      const activeLog = await tx.sharedAssetLog.findFirst({ where: { assetId, action: 'CHECK_OUT', returnedAt: null }, orderBy: { createdAt: 'desc' } });
      if (!activeLog) throw new AppError('Aktif zimmet geçmişi bulunamadı. İşlem durduruldu.', 409);
      await tx.sharedAssetLog.update({ where: { id: activeLog.id }, data: { returnedAt } });
      await tx.sharedAssetLog.create({ data: {
        requestKey: data.requestKey || null, assetId, action: 'CHECK_IN', assetCodeSnapshot: asset.assetCode,
        assetNameSnapshot: asset.assetName, holderType: asset.currentHolderType, statusFrom: 'LOANED', statusTo: targetStatus,
        borrowerName, employeeId: asset.currentEmployeeId, roomId: asset.currentRoomId,
        borrowedAt: asset.borrowedAt || activeLog.borrowedAt, returnedAt, expectedReturnDate: asset.expectedReturnDate,
        notes, createdById: data.createdById || null,
      } });
      return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: any) => {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2034') throw new AppError('Teslim alma işlemi eşzamanlı değişiklik nedeniyle tamamlanamadı. Yeniden deneyin.', 409);
      if (error?.code === 'P2002') throw new AppError('Bu teslim alma isteği daha önce işlendi.', 409);
      throw error;
    });
  }

  public static async updateAssetStatus(assetId: string, data: {
    status: SharedAssetStatus; locationNote?: string; notes?: string; createdById?: string; requestKey?: string;
  }) {
    if (!['AVAILABLE', 'MAINTENANCE', 'RETIRED'].includes(data.status)) throw new AppError('Durum ekranından zimmetli durumuna geçilemez; zimmet işlemini kullanın.', 400);
    const notes = boundedText(data.notes, 'Durum değişikliği gerekçesi', 1000, { required: data.status === 'RETIRED', casing: 'upper' });
    const locationNote = boundedText(data.locationNote, 'Konum', 200, { casing: 'upper' });
    return prisma.$transaction(async (tx) => {
      const replay = await idempotentLog(tx, data.requestKey, assetId, 'STATUS_CHANGE', data.createdById);
      if (replay) return replay;
      const asset = await tx.sharedAsset.findUnique({ where: { id: assetId } });
      if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);
      if (asset.status === 'LOANED') throw new AppError('Zimmetli eşyanın durumu doğrudan değiştirilemez. Önce teslim alma işlemi yapın.', 409);
      if (asset.status === 'RETIRED' && data.status !== 'RETIRED') throw new AppError('Hurdaya ayrılmış ortak eşya yeniden kullanıma açılamaz.', 409);
      if (asset.status === data.status && (!locationNote || locationNote === asset.locationNote)) throw new AppError('Ortak eşya zaten seçilen durumda.', 409);
      if (!asset.stockItemId) throw new AppError('Ortak eşyanın bağlı stok kartı bulunamadı.', 409);
      if (data.status === 'RETIRED') {
        const retired = await tx.$executeRaw`
          UPDATE "StockItem" SET "totalStock" = "totalStock" - 1, "physicalStatus" = 'HURDA', "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${asset.stockItemId} AND "totalStock" - "usedStock" - "usedInRooms" >= 1
        `;
        if (retired !== 1) throw new AppError('Hurda işlemi için depoda müsait ortak eşya stoğu bulunamadı.', 409);
        await tx.stockMovement.create({ data: {
          stockItemId: asset.stockItemId, sharedAssetId: asset.id, type: 'RETIREMENT', quantity: -1,
          itemNameSnapshot: asset.assetName, serialNo: asset.serialNo || asset.assetCode,
          reason: 'ORTAK EŞYA HURDAYA AYIRMA', notes, createdById: data.createdById || null,
        } });
      } else {
        await tx.stockItem.update({ where: { id: asset.stockItemId }, data: { physicalStatus: data.status === 'MAINTENANCE' ? 'BAKIMDA' : 'KULLANILABİLİR' } });
      }
      const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, updatedAt: asset.updatedAt }, data: {
        status: data.status, ...(locationNote && { locationNote }), ...(notes && { notes }),
      } });
      if (changed.count !== 1) throw new AppError('Ortak eşya başka bir kullanıcı tarafından güncellendi.', 409);
      await tx.sharedAssetLog.create({ data: {
        requestKey: data.requestKey || null, assetId, action: 'STATUS_CHANGE', assetCodeSnapshot: asset.assetCode,
        assetNameSnapshot: asset.assetName, statusFrom: asset.status, statusTo: data.status,
        notes: notes || `Durum ${asset.status} → ${data.status} olarak değiştirildi.`, createdById: data.createdById || null,
      } });
      return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  public static async addMaintenanceLog(assetId: string, data: {
    action: 'MAINTENANCE_START' | 'MAINTENANCE_END' | 'FAULT_REPORTED' | 'REPAIR_COMPLETED';
    notes: string; createdById?: string; requestKey?: string;
  }) {
    const allowed = ['MAINTENANCE_START', 'MAINTENANCE_END', 'FAULT_REPORTED', 'REPAIR_COMPLETED'];
    if (!allowed.includes(data.action)) throw new AppError('Geçersiz bakım/arıza işlemi.', 400);
    const notes = boundedText(data.notes, 'Bakım/arıza açıklaması', 1000, { required: true, minLength: 5, casing: 'upper' })!;
    const starts = ['MAINTENANCE_START', 'FAULT_REPORTED'].includes(data.action);
    const targetStatus: SharedAssetStatus = starts ? 'MAINTENANCE' : 'AVAILABLE';
    return prisma.$transaction(async (tx) => {
      const replay = await idempotentLog(tx, data.requestKey, assetId, data.action, data.createdById);
      if (replay) return replay;
      const asset = await tx.sharedAsset.findUnique({ where: { id: assetId } });
      if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);
      if (asset.status === 'LOANED') throw new AppError('Zimmetli eşya bakıma alınamaz. Önce teslim alma işlemiyle zimmeti kapatın.', 409);
      if (asset.status === 'RETIRED') throw new AppError('Hurdaya ayrılmış eşya için yeni bakım işlemi açılamaz.', 409);
      if (starts && asset.status !== 'AVAILABLE') throw new AppError('Bu eşya zaten bakımda/arızalı.', 409);
      if (!starts && asset.status !== 'MAINTENANCE') throw new AppError('Yalnızca bakımda/arızalı eşyanın bakım işlemi tamamlanabilir.', 409);
      if (!asset.stockItemId) throw new AppError('Ortak eşyanın bağlı stok kartı bulunamadı.', 409);
      const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, status: asset.status, updatedAt: asset.updatedAt }, data: { status: targetStatus } });
      if (changed.count !== 1) throw new AppError('Ortak eşya başka bir işlemde değişti. Listeyi yenileyin.', 409);
      await tx.stockItem.update({ where: { id: asset.stockItemId }, data: { physicalStatus: targetStatus === 'MAINTENANCE' ? 'BAKIMDA' : 'KULLANILABİLİR' } });
      await tx.sharedAssetLog.create({ data: {
        requestKey: data.requestKey || null, assetId, action: data.action,
        assetCodeSnapshot: asset.assetCode, assetNameSnapshot: asset.assetName,
        statusFrom: asset.status, statusTo: targetStatus, notes, createdById: data.createdById || null,
      } });
      return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
