import { Prisma, SharedAssetStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { boundedText, normalizeInventoryItemName, normalizeUpper } from '../utils/normalization';
import { releaseRoomStock } from '../utils/stockBalance';
import { broadcastSharedAssetEvent } from '../websocket/sharedAssetSocket';

const categories = new Set([
  'GENEL', 'ODA DEMİRBAŞI', 'MOBİLYA', 'YATAK & BAZA', 'TEKSTİL & MEFRUŞAT',
  'ELEKTRONİK', 'BEYAZ EŞYA', 'ISITMA & SOĞUTMA', 'AYDINLATMA & ELEKTRİK',
  'MUTFAK & YEMEKHANE', 'BANYO & SIHHİ TESİSAT', 'TEMİZLİK MALZEMESİ',
  'SARF MALZEMESİ', 'TEKNİK BAKIM & YEDEK PARÇA', 'ANAHTAR, KİLİT & GÜVENLİK',
  'İŞ SAĞLIĞI & GÜVENLİĞİ', 'YANGIN & ACİL DURUM', 'KIRTASİYE',
  'BAHÇE & PEYZAJ', 'TEMİZLİK & BAKIM MAKİNELERİ', 'EL ALETLERİ & TAMİR',
  'ELEKTRİKLİ EV ALETLERİ', 'GÜVENLİK & İŞ SAĞLIĞI', 'MOBİLYA & MEFRUŞAT',
  'ELEKTRONİK & BİLİŞİM', 'MUTFAK & SERVİS EKİPMANLARI', 'ÖLÇÜM & TEST CİHAZLARI',
  'MERDİVEN & İSKELE', 'TAŞIMA & DEPOLAMA', 'GENEL EŞYALAR', 'DİĞER',
]);

const categoryPrefixes: Record<string, string> = {
  'TEMİZLİK & BAKIM MAKİNELERİ': 'MAK', 'EL ALETLERİ & TAMİR': 'ALT', 'BAHÇE & PEYZAJ': 'BHC',
  'ELEKTRİKLİ EV ALETLERİ': 'ELK', 'GÜVENLİK & İŞ SAĞLIĞI': 'GVN', 'MOBİLYA & MEFRUŞAT': 'MOB',
  'ELEKTRONİK & BİLİŞİM': 'ELT', 'ISITMA & SOĞUTMA': 'IKL', 'MUTFAK & SERVİS EKİPMANLARI': 'MTF',
  'ÖLÇÜM & TEST CİHAZLARI': 'TST', 'MERDİVEN & İSKELE': 'MRD', 'TAŞIMA & DEPOLAMA': 'TSM',
  'GENEL EŞYALAR': 'ORT', GENEL: 'ORT', 'BEYAZ EŞYA': 'BEY', 'ODA DEMİRBAŞI': 'DMR',
  'TEMİZLİK MALZEMESİ': 'TMZ', 'TEKNİK BAKIM & YEDEK PARÇA': 'TKN', 'MOBİLYA': 'MOB',
};

const assetInclude = {
  stockItem: { select: { id: true, itemCode: true, itemName: true, totalStock: true, usedStock: true, usedInRooms: true, isActive: true, physicalStatus: true } },
  currentEmployee: {
    select: {
      id: true, firstName: true, lastName: true, registrationNo: true, department: true,
      beds: { select: { room: { select: { roomNumber: true, floor: true, block: { select: { name: true } } } } } },
    },
  },
  currentRoom: { select: { id: true, roomNumber: true, floor: true, roomType: true, block: { select: { name: true } } } },
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
          status: true, createdAt: true, updatedAt: true,
        }, orderBy: [{ status: 'asc' }, { assetName: 'asc' }], take: 5000 }),
      canManage ? prisma.employee.findMany({
        where: { isDeleted: false, status: 'RESIDENT' },
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
        asset: { select: {
          id: true, assetCode: true, assetName: true, category: true, brandModel: true, serialNo: true,
          status: true, locationNote: true, currentRoomId: true, borrowedAt: true, expectedReturnDate: true,
        } },
        createdBy: { select: { id: true, fullName: true } },
      }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.sharedAssetLog.count({ where }),
    ]);
    return { items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  public static async createAsset(data: {
    stockItemId?: string; assetName?: string; assetCode?: string; category?: string; brandModel?: string;
    serialNo?: string; locationNote?: string; notes?: string;
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
        if (!stock || !stock.isActive) throw new AppError('Seçilen aktif stok kartı depoda bulunamadı.', 404);
        if (!['ORTAK_EŞYA', 'ORTAK_EKİPMAN', 'ORTAK_KULLANIM'].includes(stock.itemType)) {
          throw new AppError('Ortak kullanım cihazı yalnızca "Ortak Eşya" tipindeki stok kartından tanımlanabilir. Oda demirbaşı ve kişisel zimmet ürünleri bu ekranda kullanılamaz.', 400);
        }
        const count = await tx.sharedAsset.count({ where: { stockItemId: stock.id, status: { not: 'RETIRED' } } });
        if (count >= stock.totalStock) {
          throw new AppError(`Bu stok kartına ait toplam stok miktarı kadar (${stock.totalStock} Adet) ortak eşya cihaz kaydı zaten tanımlanmış.`, 409);
        }
        const assetName = normalizeInventoryItemName(boundedText(data.assetName ?? stock.itemName, 'Ortak eşya adı', 120, { required: true, casing: 'upper' }))!;
        const category = normalizeUpper(data.category ?? stock.category) || 'GENEL EŞYALAR';
        if (!categories.has(category)) throw new AppError('Geçersiz ortak eşya kategorisi.', 400);
        // Stock codes identify the product; asset codes identify individual devices.
        // Older clients sent the stock code automatically, so treat it as automatic too.
        const requestedCode = code(data.assetCode);
        const assetCode = requestedCode && requestedCode !== code(stock.itemCode)
          ? requestedCode
          : await this.generateNextAssetCode(tx, category);
        const serialNo = null;

        const unlinkedRoomInventories = await tx.roomInventory.findMany({
          where: { stockItemId: stock.id, returnedAt: null, sharedAsset: null },
          include: { room: { include: { block: true } } },
          orderBy: { installedAt: 'desc' },
          take: 2,
        });
        // Tek bir eski oda zimmeti varsa bu fiziksel cihaz ortak eşya kaydına
        // dönüştürülür. Birden fazla kayıt varsa yanlış cihazın dönüştürülmemesi için
        // otomatik işlem yapılmaz.
        const unlinkedRoomInventory = unlinkedRoomInventories.length === 1 ? unlinkedRoomInventories[0] : null;

        let locationNote = boundedText(data.locationNote ?? stock.locationNote, 'Konum', 200, { casing: 'upper' });
        if (!locationNote || locationNote === 'ANA DEPO') {
          if (unlinkedRoomInventory) {
            locationNote = `${unlinkedRoomInventory.room.block.name} / Oda ${unlinkedRoomInventory.room.roomNumber}`;
          } else {
            locationNote = 'ANA DEPO';
          }
        }

        const asset = await tx.sharedAsset.create({ data: {
          requestKey: data.requestKey || null, stockItemId: stock.id, createdById: data.createdById || null,
          assetName, assetCode, category, serialNo,
          brandModel: boundedText(data.brandModel ?? stock.specifications, 'Marka / model', 150, { casing: 'upper' }),
          warrantyEndDate: null, locationNote,
          notes: boundedText(data.notes, 'Açıklama', 1000, { casing: 'upper' }), status: 'AVAILABLE',
        } });
        if (unlinkedRoomInventory) {
          await tx.roomInventory.update({
            where: { id: unlinkedRoomInventory.id },
            data: {
              returnedAt: new Date(),
              status: 'RETIRED',
              notes: `${unlinkedRoomInventory.notes ? `${unlinkedRoomInventory.notes} / ` : ''}ORTAK EŞYA KONUM KAYDINA DÖNÜŞTÜRÜLDÜ: ${asset.assetCode}`,
            },
          });
          await releaseRoomStock(tx, stock.id, unlinkedRoomInventory.quantity);
          await tx.stockMovement.create({ data: {
            stockItemId: stock.id,
            roomId: unlinkedRoomInventory.roomId,
            roomInventoryId: unlinkedRoomInventory.id,
            sharedAssetId: asset.id,
            type: 'STATUS_CHANGE',
            quantity: 0,
            itemNameSnapshot: stock.itemName,
            roomLabelSnapshot: `${unlinkedRoomInventory.room.block.name} / ODA ${unlinkedRoomInventory.room.roomNumber}`,
            brand: unlinkedRoomInventory.brand,
            serialNo: unlinkedRoomInventory.serialNo,
            reason: 'ODA ZİMMETİNDEN ORTAK EŞYA KONUMUNA DÖNÜŞÜM',
            notes: 'Aynı fiziksel cihazın iki kez stoktan düşmesini önlemek için oda zimmeti kapatıldı; cihaz ortak eşya konumuna aktarıldı.',
            createdById: data.createdById || null,
          } });
        }
        await tx.sharedAssetLog.create({ data: {
          assetId: asset.id, action: 'CREATED', assetCodeSnapshot: asset.assetCode, assetNameSnapshot: asset.assetName,
          statusTo: 'AVAILABLE', notes: 'Ortak eşya stok kartına bağlı olarak oluşturuldu.', createdById: data.createdById || null,
        } });
        return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') {
        const target = String(error.meta?.target || '');
        if (target.includes('stockItemId')) throw new AppError('Veritabanında eski tek cihaz kısıtı bulunuyor. Güncel veritabanı migration işlemlerini uygulayın.', 409);
        if (target.includes('serialNo')) throw new AppError('Bu üretici seri numarası başka bir aktif cihazda kullanılıyor. Her fiziksel cihazın seri numarası farklı olmalıdır.', 409);
        if (target.includes('assetCode')) throw new AppError('Bu cihaz kodu zaten kullanılıyor. Farklı bir kod girin veya otomatik kod üretimini kullanın.', 409);
        throw new AppError('Cihaz kodu, seri numarası veya işlem anahtarı başka bir kayıtta kullanılıyor.', 409);
      }
      if (error?.code === 'P2034') throw new AppError('Ortak eşya aynı anda değiştirildi. Listeyi yenileyip tekrar deneyin.', 409);
      throw error;
    }
  }

  public static async checkOutAsset(assetId: string, data: {
    holderType?: 'EMPLOYEE' | 'ROOM' | 'OTHER'; employeeId?: string; customBorrowerName?: string;
    roomId?: string; expectedReturnDate?: string; notes?: string; createdById?: string; requestKey?: string;
  }) {
    const holderType = data.holderType || (data.employeeId ? 'EMPLOYEE' : 'OTHER');
    if (!['EMPLOYEE', 'OTHER'].includes(holderType)) {
      throw new AppError('Ortak kullanım cihazı odaya zimmetlenemez. Oda cihazın sabit konumuysa "Konumu Güncelle" işlemini kullanın; kullanım için personel veya harici kişi seçin.', 400);
    }
    const notes = boundedText(data.notes, 'Zimmet açıklaması', 1000, { casing: 'upper' });
    const expectedReturnDate = dateOnly(data.expectedReturnDate, 'Beklenen iade tarihi');
    if (expectedReturnDate && expectedReturnDate < new Date()) throw new AppError('Beklenen iade tarihi geçmiş bir tarih olamaz.', 400);
    try {
      const res = await prisma.$transaction(async (tx) => {
        const replay = await idempotentLog(tx, data.requestKey, assetId, 'CHECK_OUT', data.createdById);
        if (replay) return replay;
        await tx.$queryRaw`SELECT id FROM "SharedAsset" WHERE id = ${assetId} FOR UPDATE`;
        const asset = await tx.sharedAsset.findUnique({ where: { id: assetId }, include: { stockItem: true } });
        if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);
        if (asset.status !== 'AVAILABLE') throw new AppError('Yalnızca depoda ve müsait durumdaki eşya zimmetlenebilir.', 409);
        if (!asset.stockItem || !asset.stockItem.isActive || asset.stockItem.physicalStatus === 'HURDA') throw new AppError('Ortak eşyanın aktif stok kartı bulunamadı.', 409);

        let employeeId: string | null = null;
        let roomId: string | null = null;
        let borrowerName: string;
        if (holderType === 'EMPLOYEE') {
          if (!data.employeeId) throw new AppError('Personel zimmeti için personel seçilmelidir.', 400);
          const employee = await tx.employee.findFirst({ where: { id: data.employeeId, isDeleted: false, status: 'RESIDENT' } });
          if (!employee) throw new AppError('Yalnızca odada konaklayan aktif personellere ortak eşya zimmetlenebilir.', 404);
          // Ortak cihazdaki kullanım, personelin kalıcı zimmeti değildir. Bu nedenle
          // personel envanteri ve stok bakiyesi burada değiştirilmez; yalnızca kullanım kaydı açılır.
          employeeId = employee.id;
          borrowerName = `${employee.firstName} ${employee.lastName}${employee.department ? ` (${employee.department})` : ''}`;
        } else {
          borrowerName = boundedText(data.customBorrowerName, 'Teslim alan kişi', 120, { required: true, casing: 'upper' })!;
        }

        const borrowedAt = new Date();
        const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, status: 'AVAILABLE', updatedAt: asset.updatedAt }, data: {
          status: 'LOANED', currentHolderType: holderType, currentEmployeeId: employeeId, currentRoomId: roomId,
          currentPersonnelInventoryId: null, currentRoomInventoryId: null,
          borrowedAt, expectedReturnDate,
        } });
        if (changed.count !== 1) throw new AppError('Ortak eşya başka bir işlemde değişti. Listeyi yenileyin.', 409);
        await tx.sharedAssetLog.create({ data: {
          requestKey: data.requestKey || null, assetId: asset.id, action: 'CHECK_OUT', assetCodeSnapshot: asset.assetCode,
          assetNameSnapshot: asset.assetName, holderType, statusFrom: 'AVAILABLE', statusTo: 'LOANED', borrowerName,
          employeeId, roomId, borrowedAt, expectedReturnDate, notes, createdById: data.createdById || null,
        } });
        return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      broadcastSharedAssetEvent('SHARED_ASSET_UPDATED', { assetId: res.id, status: res.status });
      return res;
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
    const notes = boundedText(data.notes, 'Teslim açıklaması', 1000, { casing: 'upper' });
    const locationNote = boundedText(data.locationNote, 'Teslim konumu', 200, { casing: 'upper' });
    const res = await prisma.$transaction(async (tx) => {
      const replay = await idempotentLog(tx, data.requestKey, assetId, 'CHECK_IN', data.createdById);
      if (replay) return replay;
      await tx.$queryRaw`SELECT id FROM "SharedAsset" WHERE id = ${assetId} FOR UPDATE`;
      const asset = await tx.sharedAsset.findUnique({ where: { id: assetId }, include: {
        stockItem: true, currentEmployee: true, currentRoom: { include: { block: true } },
      } });
      if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);
      if (asset.status !== 'LOANED' || !asset.stockItem) throw new AppError('Yalnızca aktif zimmetli ortak eşya teslim alınabilir.', 409);
      const activeLog = await tx.sharedAssetLog.findFirst({
        where: { assetId, action: 'CHECK_OUT', returnedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      // Teslim alan kişi metnini ilk kullanım kaydından aynen koru. Böylece
      // departman gibi ek bilgiler teslim alma hareketinde kaybolmaz.
      const borrowerName = activeLog?.borrowerName || activeBorrowerName(asset);
      const returnedAt = new Date();
      // Kullanım sonunda cihaz sabit konumunda kalır. Konum, kullanım açma/kapatma
      // işleminden bağımsız olarak "Konumu Güncelle" akışından yönetilir.
      const returnLocation = locationNote || asset.locationNote || 'ANA DEPO';

      if (asset.currentPersonnelInventoryId) {
        await tx.inventoryItem.updateMany({ where: { id: asset.currentPersonnelInventoryId, returnedDate: null }, data: { returnedDate: returnedAt, returnedById: data.createdById || null, status: 'TAM_İADE_ALINDI', notes } });
      }

      if (asset.currentRoomInventoryId) {
        await tx.roomInventory.updateMany({ where: { id: asset.currentRoomInventoryId, returnedAt: null }, data: { returnedAt, notes } });
        await releaseRoomStock(tx, asset.stockItem.id, 1);
      }

      const changed = await tx.sharedAsset.updateMany({ where: { id: asset.id, status: 'LOANED', updatedAt: asset.updatedAt }, data: {
        status: targetStatus, currentHolderType: null, currentEmployeeId: null, currentRoomId: null,
        currentPersonnelInventoryId: null, currentRoomInventoryId: null, borrowedAt: null, expectedReturnDate: null,
        locationNote: returnLocation,
      } });
      if (changed.count !== 1) throw new AppError('Ortak eşya başka bir işlemde değişti. Listeyi yenileyin.', 409);
      if (activeLog) {
        await tx.sharedAssetLog.update({ where: { id: activeLog.id }, data: { returnedAt } });
      }
      await tx.sharedAssetLog.create({ data: {
        requestKey: data.requestKey || null, assetId, action: 'CHECK_IN', assetCodeSnapshot: asset.assetCode,
        assetNameSnapshot: asset.assetName, holderType: asset.currentHolderType, statusFrom: 'LOANED', statusTo: targetStatus,
        borrowerName, employeeId: asset.currentEmployeeId, roomId: asset.currentRoomId,
        borrowedAt: asset.borrowedAt || (activeLog ? activeLog.borrowedAt : returnedAt), returnedAt, expectedReturnDate: asset.expectedReturnDate,
        notes, createdById: data.createdById || null,
      } });
      return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: any) => {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2034') throw new AppError('Teslim alma işlemi eşzamanlı değişiklik nedeniyle tamamlanamadı. Yeniden deneyin.', 409);
      if (error?.code === 'P2002') throw new AppError('Bu teslim alma isteği daha önce işlendi.', 409);
      throw error;
    });
    broadcastSharedAssetEvent('SHARED_ASSET_UPDATED', { assetId: res.id, status: res.status });
    return res;
  }

  public static async updateAssetStatus(assetId: string, data: {
    status: SharedAssetStatus; locationNote?: string; notes?: string; createdById?: string; requestKey?: string;
  }) {
    if (!['AVAILABLE', 'MAINTENANCE', 'RETIRED'].includes(data.status)) throw new AppError('Durum ekranından zimmetli durumuna geçilemez; zimmet işlemini kullanın.', 400);
    const notes = boundedText(data.notes, 'Durum değişikliği gerekçesi', 1000, { required: data.status === 'RETIRED', casing: 'upper' });
    const locationNote = boundedText(data.locationNote, 'Konum', 200, { casing: 'upper' });
    const res = await prisma.$transaction(async (tx) => {
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
    broadcastSharedAssetEvent('SHARED_ASSET_UPDATED', { assetId: res.id, status: res.status });
    return res;
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
    const res = await prisma.$transaction(async (tx) => {
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
      await tx.sharedAssetLog.create({ data: {
        requestKey: data.requestKey || null, assetId, action: data.action,
        assetCodeSnapshot: asset.assetCode, assetNameSnapshot: asset.assetName,
        statusFrom: asset.status, statusTo: targetStatus, notes, createdById: data.createdById || null,
      } });
      return tx.sharedAsset.findUniqueOrThrow({ where: { id: asset.id }, include: assetInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    broadcastSharedAssetEvent('SHARED_ASSET_UPDATED', { assetId: res.id, status: res.status });
    return res;
  }

  public static async deleteLog(logId: string) {
    const log = await prisma.sharedAssetLog.findUnique({ where: { id: logId } });
    if (!log) throw new AppError('İşlem kaydı bulunamadı.', 404);
    const res = await prisma.sharedAssetLog.delete({ where: { id: logId } });
    broadcastSharedAssetEvent('SHARED_ASSET_UPDATED', { assetId: log.assetId });
    return res;
  }

  public static async updateLog(logId: string, data: { borrowerName?: string; notes?: string }) {
    const log = await prisma.sharedAssetLog.findUnique({ where: { id: logId } });
    if (!log) throw new AppError('İşlem kaydı bulunamadı.', 404);
    const res = await prisma.sharedAssetLog.update({
      where: { id: logId },
      data: {
        ...(data.borrowerName !== undefined && { borrowerName: boundedText(data.borrowerName, 'Teslim alan kişi', 120, { casing: 'upper' }) }),
        ...(data.notes !== undefined && { notes: boundedText(data.notes, 'Açıklama', 1000, { casing: 'upper' }) }),
      },
    });
    broadcastSharedAssetEvent('SHARED_ASSET_UPDATED', { assetId: log.assetId });
    return res;
  }
}
