import { Prisma, RoomInventoryStatus, StockMovementType } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { normalizeInventoryItemName } from '../utils/normalization';
import { releaseRoomStock, reserveRoomStock } from '../utils/stockBalance';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { config } from '../config';
import { syncSharedAssetIdentity, syncSharedAssetReplacement, syncSharedAssetReturn, syncSharedAssetRoomAssignment, syncSharedAssetRoomTransfer } from './sharedAssetSync';

const stockCategories = new Set([
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

const cleanOptional = (value: unknown, field = 'Metin alanı', maxLength = 500) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError(`${field} geçersiz.`, 400);
  const clean = value.trim();
  if (clean.length > maxLength) throw new AppError(`${field} en fazla ${maxLength} karakter olabilir.`, 400);
  return clean ? clean.toLocaleUpperCase('tr-TR') : null;
};
const allowedItemTypes = new Set(['DEMİRBAŞ', 'SARF_MALZEME', 'ORTAK_EŞYA', 'ORTAK_EKİPMAN', 'ORTAK_KULLANIM']);
const sharedAssetItemTypes = new Set(['ORTAK_EŞYA', 'ORTAK_EKİPMAN', 'ORTAK_KULLANIM']);
const allowedUnits = new Set(['ADET', 'TAKIM', 'PAKET', 'KOLİ', 'METRE', 'LİTRE', 'SET', 'KİLOGRAM', 'RULO']);
const allowedPhysicalStatuses = new Set(['KULLANILABİLİR', 'KULLANIMDA', 'BAKIMDA', 'HURDA']);
const positiveInteger = (value: unknown, field: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError(`${field} sıfırdan büyük tam sayı olmalıdır.`, 400);
  return parsed;
};

const roomLabel = (room: { roomNumber: string; block: { name: string } }) => `${room.block.name} / ODA ${room.roomNumber}`;
const assetTagFor = (itemCode: string | null, id: string) => `${itemCode || 'ENV'}-${id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
const nextRoomInventoryName = async (tx: Prisma.TransactionClient, roomId: string, roomNumber: string, stockItemId: string, baseName: string) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ROOM_ITEM_NAME:${roomId}:${stockItemId}`}))`;
  const prior = await tx.roomInventory.findMany({ where: { roomId, stockItemId }, select: { itemName: true } });
  const prefix = `${roomNumber} NOLU ODA - ${baseName} `;
  const max = prior.reduce((current, entry) => {
    if (!entry.itemName.startsWith(prefix)) return current;
    const value = Number(entry.itemName.slice(prefix.length));
    return Number.isSafeInteger(value) && value > current ? value : current;
  }, 0);
  return `${prefix}${max + 1}`;
};

const categoryPrefixes: Record<string, string> = {
  'TEMİZLİK & BAKIM MAKİNELERİ': 'MAK',
  'EL ALETLERİ & TAMİR': 'ALT',
  'BAHÇE & PEYZAJ': 'BHC',
  'ELEKTRİKLİ EV ALETLERİ': 'ELK',
  'GÜVENLİK & İŞ SAĞLIĞI': 'GVN',
  'MOBİLYA & MEFRUŞAT': 'MOB',
  'ELEKTRONİK & BİLİŞİM': 'ELT',
  'ISITMA & SOĞUTMA': 'IKL',
  'MUTFAK & SERVİS EKİPMANLARI': 'MTF',
  'ÖLÇÜM & TEST CİHAZLARI': 'TST',
  'MERDİVEN & İSKELE': 'MRD',
  'TAŞIMA & DEPOLAMA': 'TSM',
  'GENEL EŞYALAR': 'ORT',
  'TEKSTİL & MEFRUŞAT': 'TEK',
  'BANYO & SIHHİ TESİSAT': 'TES',
  'MOBİLYA': 'MOB',
  'YATAK & BAZA': 'YTK',
  'ELEKTRONİK': 'ELK',
  'BEYAZ EŞYA': 'BEY',
  'AYDINLATMA & ELEKTRİK': 'AYD',
  'MUTFAK & YEMEKHANE': 'MTF',
  'TEMİZLİK MALZEMESİ': 'TMZ',
  'SARF MALZEMESİ': 'SRF',
  'TEKNİK BAKIM & YEDEK PARÇA': 'TKN',
  'ODA DEMİRBAŞI': 'DMR',
  'ANAHTAR, KİLİT & GÜVENLİK': 'GVN',
  'İŞ SAĞLIĞI & GÜVENLİĞİ': 'ISG',
  'YANGIN & ACİL DURUM': 'YNG',
  'KIRTASİYE': 'KRT',
  'GENEL': 'STK',
};

const getCategoryPrefix = (category: string) => categoryPrefixes[category] || 'STK';

export class StockService {
  public static async generateNextItemCode(category?: string): Promise<string> {
    const cleanCat = cleanOptional(category) || 'GENEL';
    const prefix = getCategoryPrefix(cleanCat);
    const existing = await prisma.stockItem.findMany({
      where: { itemCode: { startsWith: `${prefix}-` } },
      select: { itemCode: true },
    });
    let maxIndex = 0;
    existing.forEach((item) => {
      if (item.itemCode) {
        const parts = item.itemCode.split('-');
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxIndex) maxIndex = num;
      }
    });
    return `${prefix}-${String(maxIndex + 1).padStart(3, '0')}`;
  }

  public static async getOverview(options: { includePersonnel?: boolean } = {}) {
    const itemCount = await prisma.stockItem.count();
    if (itemCount > config.stock.overviewMaxItems) throw new AppError(`Stok kartı sayısı ekran sınırı olan ${config.stock.overviewMaxItems.toLocaleString('tr-TR')} kaydı aşıyor. Arşivleme veya sunucu taraflı listeleme yapılandırması gerekir.`, 413);
    const includePersonnel = options.includePersonnel === true;
    const [items, rooms] = await Promise.all([
      prisma.stockItem.findMany({
        orderBy: [{ isActive: 'desc' }, { itemName: 'asc' }],
        include: {
          roomInventories: {
            where: { returnedAt: null },
            orderBy: { installedAt: 'desc' },
            include: {
              room: { include: { block: true } },
              maintenances: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, priority: true, title: true, description: true, reportedBy: true, assignedTo: true, createdAt: true, resolvedAt: true, resolutionNote: true } },
            },
          },
          inventories: includePersonnel ? {
            where: { returnedDate: null, isDeleted: false },
            orderBy: { assignedDate: 'desc' },
            include: { employee: { select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true } } },
          } : false,
          sharedAssets: {
            select: { id: true, assetCode: true, assetName: true, serialNo: true, brandModel: true, status: true, locationNote: true, currentRoomId: true, borrowedAt: true },
          },
          roomStandard: true,
          _count: { select: { movements: true } },
        },
      }),
      prisma.room.findMany({
        orderBy: [{ block: { name: 'asc' } }, { floor: 'asc' }, { roomNumber: 'asc' }],
        select: { id: true, roomNumber: true, roomType: true, floor: true, capacity: true, status: true, block: { select: { id: true, name: true } } },
      }),
    ]);

    const enriched = items.map((item) => {
      const roomInventorySum = item.roomInventories.reduce((sum, entry) => sum + entry.quantity, 0);
      // Ortak eşya ilk tanımlandığı anda fiziksel stoktan ayrılır; cihazın ana depoda
      // veya çamaşırhanede olması bu muhasebeyi değiştirmez.
      const sharedAssetsAllocated = (item.sharedAssets || []).filter((sa) => sa.status !== 'RETIRED').length;
      const effectiveUsedInRooms = Math.max(item.usedInRooms, roomInventorySum);
      const availableStock = Math.max(0, item.totalStock - item.usedStock - effectiveUsedInRooms - sharedAssetsAllocated);
      const standard = item.roomStandard;
      const missingRooms = standard ? rooms
        .filter((room) => room.roomType === standard.roomType)
        .map((room) => {
          const required = standard.fixedQuantity + (standard.quantityPerBed * room.capacity);
          const assigned = item.roomInventories.filter((entry) => entry.roomId === room.id).reduce((sum, entry) => sum + entry.quantity, 0);
          return { roomId: room.id, roomNumber: room.roomNumber, blockName: room.block.name, required, assigned, missing: Math.max(0, required - assigned) };
        })
        .filter((room) => room.missing > 0)
        : [];
      const standardRoomCount = standard ? rooms.filter((room) => room.roomType === standard.roomType).length : 0;

      return {
        ...item,
        inventories: 'inventories' in item ? item.inventories : [],
        usedInRooms: effectiveUsedInRooms,
        sharedAssetsInLocations: sharedAssetsAllocated,
        availableStock,
        serviceCount: item.roomInventories.filter((entry) => entry.status === 'IN_SERVICE').reduce((sum, entry) => sum + entry.quantity, 0),
        issueCount: item.roomInventories.filter((entry) => ['MAINTENANCE_REQUIRED', 'DAMAGED', 'LOST', 'REPLACEMENT_REQUIRED'].includes(entry.status)).reduce((sum, entry) => sum + entry.quantity, 0),
        roomCoverage: standard ? {
          standard,
          totalRooms: standardRoomCount,
          completeRooms: standardRoomCount - missingRooms.length,
          missingTotal: missingRooms.reduce((sum, room) => sum + room.missing, 0),
          missingRooms,
        } : null,
      };
    });

    const summary = enriched.reduce((result, item) => {
      result.totalRegistered += item.totalStock;
      result.available += item.availableStock;
      result.inRooms += item.usedInRooms;
      result.inService += item.serviceCount;
      result.issues += item.issueCount;
      return result;
    }, { totalRegistered: 0, available: 0, inRooms: 0, inService: 0, issues: 0 });

    return { items: enriched, rooms, summary };
  }

  public static async setRoomStandard(stockItemId: string, data: { fixedQuantity?: number; quantityPerBed?: number; roomType?: string }) {
    const fixedQuantity = Number(data.fixedQuantity || 0);
    const quantityPerBed = Number(data.quantityPerBed || 0);
    const roomType = cleanOptional(data.roomType, 'Oda türü', 50) || 'PERSONEL_ODASI';
    if (!Number.isInteger(fixedQuantity) || fixedQuantity < 0 || !Number.isInteger(quantityPerBed) || quantityPerBed < 0) {
      throw new AppError('Oda standardı miktarları negatif olmayan tam sayı olmalıdır.', 400);
    }
    const item = await prisma.stockItem.findUnique({ where: { id: stockItemId }, select: { id: true, itemType: true } });
    if (!item) throw new AppError('Stok kartı bulunamadı.', 404);
    if (item.itemType === 'SARF_MALZEME') throw new AppError('Sarf malzemesi için sabit oda standardı tanımlanamaz.', 400);
    if (fixedQuantity + quantityPerBed === 0) {
      await prisma.roomStockStandard.deleteMany({ where: { stockItemId } });
      return null;
    }
    return prisma.roomStockStandard.upsert({
      where: { stockItemId },
      create: { stockItemId, roomType, fixedQuantity, quantityPerBed },
      update: { roomType, fixedQuantity, quantityPerBed },
    });
  }

  public static async getMovements(filters: {
    search?: string; stockItemId?: string; roomInventoryId?: string; type?: StockMovementType; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number;
  } = {}, options: { includePersonnel?: boolean } = {}) {
    const page = filters.page && filters.page > 0 ? Math.floor(filters.page) : 1;
    const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.min(Math.floor(filters.pageSize), 100) : 50;
    const where: Prisma.StockMovementWhereInput = options.includePersonnel === true
      ? {}
      : { type: { notIn: ['PERSONNEL_ASSIGNMENT', 'PERSONNEL_RETURN'] } };
    if (filters.stockItemId) where.stockItemId = filters.stockItemId;
    if (filters.roomInventoryId) where.roomInventoryId = filters.roomInventoryId;
    if (filters.type) {
      if (options.includePersonnel !== true && ['PERSONNEL_ASSIGNMENT', 'PERSONNEL_RETURN'].includes(filters.type)) {
        throw new AppError('Personel stok hareketlerini görüntüleme yetkiniz bulunmamaktadır.', 403);
      }
      where.type = filters.type;
    }
    if (filters.dateStart || filters.dateEnd) {
      const start = parseIstanbulDateBoundary(filters.dateStart, false);
      const end = parseIstanbulDateBoundary(filters.dateEnd, true);
      assertDateRange(start, end);
      where.createdAt = { ...(start && { gte: start }), ...(end && { lte: end }) };
    }
    const search = cleanOptional(filters.search, 'Hareket araması', 100);
    if (search) {
      where.AND = search.split(/\s+/).map((token) => ({ OR: [
        { itemNameSnapshot: { contains: token, mode: 'insensitive' } },
        { roomLabelSnapshot: { contains: token, mode: 'insensitive' } },
        { reason: { contains: token, mode: 'insensitive' } },
        { notes: { contains: token, mode: 'insensitive' } },
        { stockItem: { itemCode: { contains: token, mode: 'insensitive' } } },
        { employee: { firstName: { contains: token, mode: 'insensitive' } } },
        { employee: { lastName: { contains: token, mode: 'insensitive' } } },
        { employee: { registrationNo: { contains: token, mode: 'insensitive' } } },
        { createdBy: { fullName: { contains: token, mode: 'insensitive' } } },
      ] }));
    }
    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          stockItem: { select: { itemCode: true, unit: true } }, createdBy: { select: { fullName: true } },
          employee: { select: { firstName: true, lastName: true, registrationNo: true } },
          maintenance: { select: { id: true, title: true, type: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return { items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  public static async getPersonnelOptions() {
    return prisma.employee.findMany({
      where: { isDeleted: false, status: 'RESIDENT' },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
    });
  }

  public static async createStockItem(data: {
    itemName: string; category?: string; itemType?: string; unit?: string;
    specifications?: string; physicalStatus?: string;
    locationNote?: string; totalStock?: number; createdById?: string; requestKey?: string;
  }) {
    if (typeof data.itemName !== 'string' || data.itemName.trim().length > 120) throw new AppError('Stok kalemi adı zorunlu ve en fazla 120 karakter olmalıdır.', 400);
    const itemName = normalizeInventoryItemName(data.itemName);
    if (!itemName) throw new AppError('Stok kalemi adı zorunludur.', 400);
    const category = cleanOptional(data.category) || 'GENEL';
    if (!stockCategories.has(category)) throw new AppError('Geçersiz stok kategorisi seçildi.', 400);

    let itemCode: string;

    const itemType = cleanOptional(data.itemType) || 'DEMİRBAŞ';
    if (!allowedItemTypes.has(itemType)) throw new AppError('Geçersiz stok kalemi tipi.', 400);
    const physicalStatus = cleanOptional(data.physicalStatus, 'Fiziksel durum', 30) || 'KULLANILABİLİR';
    if (!allowedPhysicalStatuses.has(physicalStatus)) throw new AppError('Geçersiz fiziksel durum.', 400);
    const unit = cleanOptional(data.unit, 'Ölçü birimi', 20) || 'ADET';
    if (!allowedUnits.has(unit)) throw new AppError('Geçersiz ölçü birimi.', 400);
    const specifications = cleanOptional(data.specifications, 'Teknik detay', 500);
    const locationNote = cleanOptional(data.locationNote, 'Konum bilgisi', 200);
    let totalStock = Number(data.totalStock || 0);
    if ((itemType === 'ORTAK_EKİPMAN' || itemType === 'ORTAK_KULLANIM') && totalStock === 0) {
      totalStock = 1;
    }
    if (!Number.isInteger(totalStock) || totalStock < 0) throw new AppError('Başlangıç miktarı negatif olamaz.', 400);
    if ((itemType === 'ORTAK_EKİPMAN' || itemType === 'ORTAK_KULLANIM') && totalStock !== 1) throw new AppError('Takip edilen ortak eşyalar her fiziksel cihaz için ayrı stok kartında 1 adet olarak açılmalıdır.', 400);
    if (physicalStatus === 'HURDA' && totalStock > 0) throw new AppError('Hurda durumundaki yeni stok kartında başlangıç bakiyesi bulunamaz.', 400);

    try {
    return await prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockItem.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if ((prior.createdById || null) !== (data.createdById || null) || prior.itemName !== itemName) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return prior;
        }
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`STOCK_CARD:${category}`}))`;
      const prefix = getCategoryPrefix(category);
      const existingCodes = await tx.stockItem.findMany({ where: { itemCode: { startsWith: `${prefix}-` } }, select: { itemCode: true } });
      const maxIndex = existingCodes.reduce((max, entry) => {
        const parsed = Number(entry.itemCode?.split('-').at(-1));
        return Number.isInteger(parsed) && parsed > max ? parsed : max;
      }, 0);
      itemCode = `${prefix}-${String(maxIndex + 1).padStart(3, '0')}`;
      const item = await tx.stockItem.create({
        data: {
          requestKey: data.requestKey || null, createdById: data.createdById || null,
          itemName, itemCode, category, itemType, specifications, physicalStatus,
          warrantyEndDate: null, locationNote, totalStock, minimumStock: 0,
          unit,
        },
      });
      await tx.stockMovement.create({ data: {
          stockItemId: item.id, type: 'OPENING', quantity: totalStock,
          itemNameSnapshot: item.itemName, reason: 'AÇILIŞ STOKU', createdById: data.createdById,
      } });

      return item;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Aynı ad veya stok koduyla kayıtlı bir stok kartı bulunuyor.', 409);
      if (error?.code === 'P2034') throw new AppError('Stok kartı aynı anda oluşturuldu. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    }
  }

  public static async receive(stockItemId: string, data: { quantity: number; reason?: string; notes?: string; createdById?: string; requestKey?: string }) {
    const quantity = positiveInteger(data.quantity, 'Giriş miktarı');
    const reason = cleanOptional(data.reason, 'Giriş nedeni', 100);
    if (!reason) throw new AppError('Depo giriş nedeni zorunludur.', 400);
    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.stockItemId !== stockItemId || prior.type !== 'RECEIPT' || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return tx.stockItem.findUniqueOrThrow({ where: { id: stockItemId } });
        }
      }
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      if (['ORTAK_EKİPMAN', 'ORTAK_KULLANIM'].includes(item.itemType)) throw new AppError('Ortak eşyalar tekil cihaz olarak izlenir. Yeni cihaz için ayrı bir ortak eşya stok kartı açın.', 409);
      const updated = await tx.stockItem.update({ where: { id: item.id }, data: { totalStock: { increment: quantity } } });
      await tx.stockMovement.create({ data: {
        requestKey: data.requestKey || null, stockItemId: item.id, type: 'RECEIPT', quantity, itemNameSnapshot: item.itemName,
        reason, notes: cleanOptional(data.notes, 'Belge / açıklama', 1000), createdById: data.createdById,
      } });
      return updated;
    });
  }

  public static async assignToRoom(stockItemId: string, data: {
    roomId: string; quantity: number; brand?: string; serialNo?: string; notes?: string; createdById?: string; requestKey?: string;
  }) {
    const quantity = positiveInteger(data.quantity, 'Zimmet miktarı');
    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.stockItemId !== stockItemId || prior.type !== 'ROOM_ASSIGNMENT' || (prior.createdById || null) !== (data.createdById || null) || !prior.roomInventoryId) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return tx.roomInventory.findUniqueOrThrow({ where: { id: prior.roomInventoryId } });
        }
      }
      const [item, room] = await Promise.all([
        tx.stockItem.findUnique({ where: { id: stockItemId } }),
        tx.room.findUnique({ where: { id: data.roomId }, include: { block: true } }),
      ]);
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      if (!room) throw new AppError('Oda bulunamadı.', 404);
      if (sharedAssetItemTypes.has(item.itemType)) {
        throw new AppError('Ortak eşya odaya zimmetlenemez. Önce Ortak Eşya sayfasından cihazı tanımlayın, ardından “Konumu Güncelle” ile bulunduğu odayı seçin.', 400);
      }
      if (item.itemType !== 'SARF_MALZEME' && quantity > 1) throw new AppError('Demirbaşlar cihaz geçmişinin korunması için tek tek ve 1 adet olarak zimmetlenmelidir.', 400);
      const available = item.totalStock - item.usedStock - item.usedInRooms;
      if (available < quantity) throw new AppError(`Yetersiz müsait stok. Depoda ${available} ${item.unit} bulunuyor.`, 409);

      const inventoryName = await nextRoomInventoryName(tx, room.id, room.roomNumber, item.id, item.itemName);

      let assignment = await tx.roomInventory.create({ data: {
        roomId: room.id, stockItemId: item.id, itemName: inventoryName,
        brand: cleanOptional(data.brand, 'Marka / model', 150), serialNo: null, quantity, status: 'HEALTHY', notes: cleanOptional(data.notes, 'Dağıtım notu', 1000),
      } });
      assignment = await tx.roomInventory.update({ where: { id: assignment.id }, data: { assetTag: assetTagFor(item.itemCode, assignment.id) } });
      await reserveRoomStock(tx, item.id, quantity);
      const sharedAssetId = quantity === 1 ? await syncSharedAssetRoomAssignment(tx, item.id, assignment.id, room.id, assignment.installedAt, data.createdById, data.requestKey) : null;
      await tx.stockMovement.create({ data: {
        requestKey: data.requestKey || null, stockItemId: item.id, roomId: room.id, roomInventoryId: assignment.id,
        sharedAssetId,
        type: 'ROOM_ASSIGNMENT', quantity: -quantity, itemNameSnapshot: item.itemName,
        roomLabelSnapshot: roomLabel(room), brand: assignment.brand, serialNo: assignment.serialNo,
        reason: 'ODAYA ZİMMET', notes: assignment.notes, createdById: data.createdById,
      } });
      return assignment;
    });
  }

  public static async assignToRooms(stockItemId: string, data: {
    roomIds: string[]; quantityPerRoom: number; brand?: string; notes?: string; createdById?: string; requestKey?: string;
  }) {
    const quantityPerRoom = positiveInteger(data.quantityPerRoom, 'Oda başına zimmet miktarı');
    const roomIds = Array.from(new Set(Array.isArray(data.roomIds) ? data.roomIds : []));
    if (roomIds.length === 0) throw new AppError('En az bir hedef oda seçilmelidir.', 400);
    if (roomIds.length > 500) throw new AppError('Tek işlemde en fazla 500 odaya zimmet yapılabilir.', 400);
    const totalQuantity = roomIds.length * quantityPerRoom;

    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.stockItemId !== stockItemId || prior.type !== 'ROOM_ASSIGNMENT' || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return { assignments: [], roomCount: roomIds.length, totalQuantity };
        }
      }
      const [item, rooms] = await Promise.all([
        tx.stockItem.findUnique({ where: { id: stockItemId } }),
        tx.room.findMany({
          where: { id: { in: roomIds } },
          include: { block: true },
          orderBy: [{ block: { name: 'asc' } }, { floor: 'asc' }, { roomNumber: 'asc' }],
        }),
      ]);
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      if (sharedAssetItemTypes.has(item.itemType)) {
        throw new AppError('Ortak eşyalar toplu oda zimmetiyle dağıtılamaz. Cihazı Ortak Eşya sayfasından tanımlayıp konumunu güncelleyin.', 400);
      }
      if (item.itemType !== 'SARF_MALZEME') throw new AppError('Demirbaşlar cihaz geçmişinin korunması için tek tek zimmetlenmelidir; toplu dağıtım yalnızca sarf malzemelerinde kullanılabilir.', 400);
      if (rooms.length !== roomIds.length) throw new AppError('Seçilen odalardan biri veya birkaçı artık mevcut değil.', 409);
      const available = item.totalStock - item.usedStock - item.usedInRooms;
      if (available < totalQuantity) {
        throw new AppError(`Toplu zimmet için ${totalQuantity} ${item.unit} gerekiyor; depoda ${available} ${item.unit} mevcut.`, 409);
      }

      await reserveRoomStock(tx, item.id, totalQuantity);
      const assignments = [];
      for (const room of rooms) {
        let assignment = await tx.roomInventory.create({ data: {
          roomId: room.id,
          stockItemId: item.id,
          itemName: item.itemName,
          brand: cleanOptional(data.brand, 'Marka / model', 150),
          quantity: quantityPerRoom,
          status: 'HEALTHY',
          notes: cleanOptional(data.notes, 'Dağıtım notu', 1000),
        } });
        assignment = await tx.roomInventory.update({ where: { id: assignment.id }, data: { assetTag: assetTagFor(item.itemCode, assignment.id) } });
        await tx.stockMovement.create({ data: {
          requestKey: assignments.length === 0 ? data.requestKey || null : null,
          stockItemId: item.id,
          roomId: room.id,
          roomInventoryId: assignment.id,
          type: 'ROOM_ASSIGNMENT',
          quantity: -quantityPerRoom,
          itemNameSnapshot: item.itemName,
          roomLabelSnapshot: roomLabel(room),
          brand: assignment.brand,
          reason: 'TOPLU ODAYA ZİMMET',
          notes: assignment.notes,
          createdById: data.createdById,
        } });
        assignments.push({ ...assignment, room });
      }
      return { assignments, roomCount: rooms.length, totalQuantity };
    });
  }

  public static async returnFromRoom(inventoryId: string, data: {
    outcome: 'RETURNED' | 'RETIRED'; notes?: string; createdById?: string; requestKey?: string;
  }) {
    if (!['RETURNED', 'RETIRED'].includes(data.outcome)) throw new AppError('Geçersiz iade sonucu.', 400);
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('İade veya düşüm gerekçesi zorunludur.', 400);
    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.roomInventoryId !== inventoryId || !['ROOM_RETURN', 'RETIREMENT'].includes(prior.type) || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return tx.roomInventory.findUniqueOrThrow({ where: { id: inventoryId } });
        }
      }
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      const activeFault = await tx.maintenanceLog.findFirst({ where: { roomInventoryId: assignment.id, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true } });
      if (activeFault) throw new AppError('Bu cihazın açık arıza kaydı var. Depoya iade etmeden önce Arıza Yönetimi üzerinden kaydı kapatın.', 409);
      const isRetired = data.outcome !== 'RETURNED';
      const status: RoomInventoryStatus = 'RETIRED';
      const changed = await tx.roomInventory.updateMany({ where: { id: inventoryId, returnedAt: null, updatedAt: assignment.updatedAt }, data: {
        status, returnedAt: new Date(), notes: processNote,
      } });
      if (changed.count !== 1) throw new AppError('Zimmet başka bir işlemde değişti. Güncel listeyi yenileyin.', 409);
      await releaseRoomStock(tx, assignment.stockItem.id, assignment.quantity, isRetired);
      const sharedAssetId = assignment.quantity === 1 ? await syncSharedAssetReturn(tx, assignment.stockItem.id, 'ROOM', assignment.id, isRetired ? 'RETIRED' : 'AVAILABLE', processNote, data.createdById, data.requestKey) : null;
      await tx.stockMovement.create({ data: {
        requestKey: data.requestKey || null, stockItemId: assignment.stockItem.id, roomId: assignment.roomId, roomInventoryId: assignment.id,
        sharedAssetId,
        type: isRetired ? 'RETIREMENT' : 'ROOM_RETURN', quantity: isRetired ? -assignment.quantity : assignment.quantity,
        itemNameSnapshot: assignment.itemName, roomLabelSnapshot: roomLabel(assignment.room),
        brand: assignment.brand, serialNo: assignment.serialNo, reason: data.outcome,
        notes: processNote, createdById: data.createdById,
      } });
      return tx.roomInventory.findUniqueOrThrow({ where: { id: inventoryId } });
    });
  }

  public static async transferRoom(inventoryId: string, data: { roomId: string; notes?: string; createdById?: string; requestKey?: string }) {
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('Oda transfer gerekçesi zorunludur.', 400);
    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.roomInventoryId !== inventoryId || prior.type !== 'ROOM_TRANSFER' || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return tx.roomInventory.findUniqueOrThrow({ where: { id: inventoryId } });
        }
      }
      const [assignment, targetRoom] = await Promise.all([
        tx.roomInventory.findUnique({ where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } } }),
        tx.room.findUnique({ where: { id: data.roomId }, include: { block: true } }),
      ]);
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      if (!targetRoom) throw new AppError('Hedef oda bulunamadı.', 404);
      if (assignment.roomId === targetRoom.id) throw new AppError('Hedef oda mevcut odadan farklı olmalıdır.', 400);
      const activeFault = await tx.maintenanceLog.findFirst({ where: { roomInventoryId: assignment.id, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true } });
      if (activeFault) throw new AppError('Açık arıza kaydı bulunan cihaz transfer edilemez. Önce Arıza Yönetimi üzerinden kaydı kapatın.', 409);
      const sourceLabel = roomLabel(assignment.room);
      const targetName = await nextRoomInventoryName(tx, targetRoom.id, targetRoom.roomNumber, assignment.stockItem.id, assignment.stockItem.itemName);
      const changed = await tx.roomInventory.updateMany({ where: { id: inventoryId, roomId: assignment.roomId, returnedAt: null, updatedAt: assignment.updatedAt }, data: { roomId: targetRoom.id, itemName: targetName, notes: processNote } });
      if (changed.count !== 1) throw new AppError('Zimmet başka bir işlemde değişti. Güncel listeyi yenileyin.', 409);
      const sharedAssetId = await syncSharedAssetRoomTransfer(tx, assignment.stockItem.id, assignment.id, targetRoom.id, processNote, data.createdById, data.requestKey);
      await tx.stockMovement.create({ data: {
        requestKey: data.requestKey || null, stockItemId: assignment.stockItem.id, roomId: targetRoom.id, roomInventoryId: assignment.id,
        sharedAssetId,
        type: 'ROOM_TRANSFER', quantity: 0, itemNameSnapshot: targetName,
        roomLabelSnapshot: `${sourceLabel} → ${roomLabel(targetRoom)}`, brand: assignment.brand,
        serialNo: assignment.serialNo, reason: 'ODA DEĞİŞİMİ', notes: processNote, createdById: data.createdById,
      } });
      return tx.roomInventory.findUniqueOrThrow({ where: { id: inventoryId } });
    });
  }

  public static async updateAssignmentIdentity(inventoryId: string, data: { brand?: string; serialNo?: string; notes?: string; createdById?: string; requestKey?: string }) {
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('Cihaz kimliği değişiklik gerekçesi zorunludur.', 400);

    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.roomInventoryId !== inventoryId || prior.type !== 'STATUS_CHANGE' || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return tx.roomInventory.findUniqueOrThrow({ where: { id: inventoryId } });
        }
      }
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId },
        include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);

      const brand = cleanOptional(data.brand, 'Marka / model', 150);
      const changed = await tx.roomInventory.updateMany({
        where: { id: assignment.id, returnedAt: null, updatedAt: assignment.updatedAt },
        data: { brand, notes: processNote },
      });
      if (changed.count !== 1) throw new AppError('Zimmet başka bir kullanıcı tarafından güncellendi. Listeyi yenileyip tekrar deneyin.', 409);

      const sharedAssetId = await syncSharedAssetIdentity(tx, assignment.stockItemId, assignment.id, null, brand, processNote, data.createdById);

      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItemId,
        sharedAssetId,
        roomId: assignment.roomId,
        roomInventoryId: assignment.id,
        type: 'STATUS_CHANGE',
        quantity: 0,
        itemNameSnapshot: assignment.itemName,
        roomLabelSnapshot: roomLabel(assignment.room),
        brand,
        serialNo: null,
        requestKey: data.requestKey || null,
        reason: 'CİHAZ KİMLİK BİLGİSİ GÜNCELLEMESİ',
        notes: `${processNote} / ÖNCEKİ MARKA: ${assignment.brand || 'KAYITLI DEĞİL'}`,
        createdById: data.createdById,
      } });

      return tx.roomInventory.findUniqueOrThrow({ where: { id: assignment.id } });
    });
  }

  public static async replaceAssignment(inventoryId: string, data: { brand?: string; serialNo?: string; notes?: string; createdById?: string; performedBy?: string; requestKey?: string }) {
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('Cihaz değişim gerekçesi ve yapılan işlem açıklaması zorunludur.', 400);
    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.type !== 'REPLACEMENT' || (prior.createdById || null) !== (data.createdById || null) || !prior.roomInventoryId) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return tx.roomInventory.findUniqueOrThrow({ where: { id: prior.roomInventoryId } });
        }
      }
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      const activeFault = await tx.maintenanceLog.findFirst({ where: { roomInventoryId: assignment.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } });
      if (!activeFault) throw new AppError('Cihaz değişimi için önce Arıza Yönetimi sayfasından aktif bir demirbaş arızası açılmalıdır.', 409);
      const available = assignment.stockItem.totalStock - assignment.stockItem.usedStock - assignment.stockItem.usedInRooms;
      if (available < assignment.quantity) throw new AppError('Değişim için depoda yeterli sağlam ürün bulunmuyor.', 409);

      const retiredAssignment = await tx.roomInventory.updateMany({ where: { id: assignment.id, returnedAt: null, updatedAt: assignment.updatedAt }, data: { status: 'RETIRED', returnedAt: new Date(), notes: processNote } });
      if (retiredAssignment.count !== 1) throw new AppError('Zimmet başka bir işlemde değişti. Güncel listeyi yenileyin.', 409);
      const retired = await tx.$executeRaw`
        UPDATE "StockItem"
        SET "totalStock" = "totalStock" - ${assignment.quantity}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${assignment.stockItem.id}
          AND "totalStock" - "usedStock" - "usedInRooms" >= ${assignment.quantity}
      `;
      if (retired !== 1) throw new AppError('Değişim sırasında müsait stok başka bir işlemde kullanıldı. İşlem geri alındı.', 409);
      let replacement = await tx.roomInventory.create({ data: {
        roomId: assignment.roomId, stockItemId: assignment.stockItem.id, itemName: assignment.itemName,
        brand: cleanOptional(data.brand, 'Yeni marka / model', 150), serialNo: null, quantity: assignment.quantity,
        status: 'HEALTHY', notes: processNote,
      } });
      replacement = await tx.roomInventory.update({ where: { id: replacement.id }, data: { assetTag: assetTagFor(assignment.stockItem.itemCode, replacement.id) } });
      const resolution = `${processNote} / ${assignment.itemName} YENİ CİHAZLA DEĞİŞTİRİLDİ`;
      await tx.maintenanceLog.update({ where: { id: activeFault.id }, data: { status: 'CLOSED', resolvedAt: new Date(), resolutionNote: resolution, assignedTo: cleanOptional(data.performedBy) || activeFault.assignedTo || 'DEPO YÖNETİMİ', updatedById: data.createdById || null } });
      await tx.maintenanceEvent.create({ data: { maintenanceId: activeFault.id, action: 'DEVICE_REPLACED', fromStatus: activeFault.status, toStatus: 'CLOSED', inventoryStatus: 'RETIRED', notes: resolution, performedBy: cleanOptional(data.performedBy) || 'DEPO YÖNETİMİ', performedById: data.createdById || null } });
      const sharedAssetId = await syncSharedAssetReplacement(tx, assignment.stockItem.id, assignment.id, replacement.id, replacement.serialNo, replacement.brand, resolution, data.createdById, data.requestKey);
      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItem.id, roomId: assignment.roomId, roomInventoryId: replacement.id,
        sharedAssetId,
        type: 'REPLACEMENT', quantity: -assignment.quantity, itemNameSnapshot: assignment.itemName,
        roomLabelSnapshot: roomLabel(assignment.room), brand: replacement.brand, serialNo: replacement.serialNo,
        requestKey: data.requestKey || null, maintenanceId: activeFault.id, reason: `ARIZALI ÜRÜN DEĞİŞİMİ / ${assignment.itemName}`, notes: resolution, createdById: data.createdById,
      } });
      return replacement;
    });
  }

  public static async updateStockItem(stockItemId: string, data: {
    itemName?: string; category?: string; itemType?: string; unit?: string;
    specifications?: string; physicalStatus?: string;
    locationNote?: string; isActive?: boolean; createdById?: string; requestKey?: string;
  }) {
    const existing = await prisma.stockItem.findUnique({ where: { id: stockItemId }, include: { _count: { select: { movements: true, roomInventories: true, inventories: true } } } });
    if (!existing) throw new AppError('Stok kartı bulunamadı.', 404);
    const category = data.category === undefined ? undefined : (cleanOptional(data.category) || 'GENEL');
    if (category !== undefined && !stockCategories.has(category)) throw new AppError('Geçersiz stok kategorisi seçildi.', 400);
    const nextItemType = data.itemType === undefined ? existing.itemType : (cleanOptional(data.itemType) || 'DEMİRBAŞ');
    if (!allowedItemTypes.has(nextItemType)) throw new AppError('Geçersiz stok kalemi tipi.', 400);
    if (nextItemType !== existing.itemType && (existing._count.movements > 0 || existing._count.roomInventories > 0 || existing._count.inventories > 0)) {
      throw new AppError('Hareket veya zimmet geçmişi bulunan stok kartının tipi değiştirilemez. Yeni bir stok kartı açılmalıdır.', 409);
    }
    if (data.itemName !== undefined && (typeof data.itemName !== 'string' || data.itemName.trim().length > 120)) throw new AppError('Stok kalemi adı en fazla 120 karakter olmalıdır.', 400);
    const nextItemName = data.itemName === undefined ? existing.itemName : normalizeInventoryItemName(data.itemName);
    if (!nextItemName) throw new AppError('Stok kalemi adı zorunludur.', 400);
    if (nextItemName !== existing.itemName && existing._count.movements > 0) {
      throw new AppError('Hareket geçmişi bulunan stok kartının adı değiştirilemez. Kayıt düzeltmesi gerekiyorsa yeni stok kartı açılmalıdır.', 409);
    }
    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') throw new AppError('Stok kartı aktiflik bilgisi geçersiz.', 400);
    const nextUnit = data.unit === undefined ? existing.unit : (cleanOptional(data.unit, 'Ölçü birimi', 20) || 'ADET');
    if (!allowedUnits.has(nextUnit)) throw new AppError('Geçersiz ölçü birimi.', 400);
    const nextPhysicalStatus = data.physicalStatus === undefined ? existing.physicalStatus : (cleanOptional(data.physicalStatus, 'Fiziksel durum', 30) || 'KULLANILABİLİR');
    if (!allowedPhysicalStatuses.has(nextPhysicalStatus)) throw new AppError('Geçersiz fiziksel durum.', 400);
    if (sharedAssetItemTypes.has(existing.itemType) && data.physicalStatus !== undefined && nextPhysicalStatus !== existing.physicalStatus) {
      throw new AppError('Ortak eşyanın fiziksel durumu zimmet, iade ve bakım süreçlerinden otomatik yönetilir.', 409);
    }
    if (sharedAssetItemTypes.has(existing.itemType) && data.isActive === false) {
      throw new AppError('Ortak eşya stok kartı doğrudan pasife alınamaz. Önce ortak eşya yaşam döngüsünü tamamlayın.', 409);
    }
    if (nextPhysicalStatus === 'HURDA' && existing.totalStock > 0) {
      throw new AppError('Bakiyesi veya aktif zimmeti bulunan stok kartı hurda durumuna alınamaz. Önce sayım/iade/düşüm süreçleriyle bakiyeyi sıfırlayın.', 409);
    }

    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.stockItemId !== stockItemId || prior.type !== 'STATUS_CHANGE' || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          return tx.stockItem.findUniqueOrThrow({ where: { id: stockItemId } });
        }
      }
      const changed = await tx.stockItem.updateMany({ where: { id: stockItemId, updatedAt: existing.updatedAt }, data: {
      ...(data.itemName !== undefined && { itemName: nextItemName }),
      ...(category !== undefined && { category }),
      ...(data.itemType !== undefined && { itemType: nextItemType }),
      ...(data.unit !== undefined && { unit: nextUnit }),
      ...(data.specifications !== undefined && { specifications: cleanOptional(data.specifications, 'Teknik detay', 500) }),
      ...(data.physicalStatus !== undefined && { physicalStatus: nextPhysicalStatus }),
      ...(data.locationNote !== undefined && { locationNote: cleanOptional(data.locationNote, 'Konum bilgisi', 200) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    } });
    if (changed.count !== 1) throw new AppError('Stok kartı başka bir kullanıcı tarafından güncellendi. Listeyi yenileyip tekrar deneyin.', 409);
    const updatedItem = await tx.stockItem.findUniqueOrThrow({ where: { id: stockItemId } });
    const before = `${existing.itemName} / ${existing.itemCode || 'KODSUZ'} / ${existing.category} / ${existing.itemType} / ${existing.unit} / ${existing.physicalStatus} / AKTİF:${existing.isActive ? 'EVET' : 'HAYIR'}`;
    const after = `${updatedItem.itemName} / ${updatedItem.itemCode || 'KODSUZ'} / ${updatedItem.category} / ${updatedItem.itemType} / ${updatedItem.unit} / ${updatedItem.physicalStatus} / AKTİF:${updatedItem.isActive ? 'EVET' : 'HAYIR'}`;
    await tx.stockMovement.create({ data: {
      requestKey: data.requestKey || null, stockItemId, type: 'STATUS_CHANGE', quantity: 0, itemNameSnapshot: updatedItem.itemName,
      reason: 'STOK KARTI GÜNCELLEMESİ', notes: `ÖNCE: ${before} / SONRA: ${after}`, createdById: data.createdById,
    } });

    if (sharedAssetItemTypes.has(updatedItem.itemType) || sharedAssetItemTypes.has(existing.itemType)) {
      await tx.sharedAsset.updateMany({
        where: { stockItemId: updatedItem.id },
        data: {
          assetCode: updatedItem.itemCode || undefined,
          assetName: updatedItem.itemName,
          category: updatedItem.category,
          brandModel: updatedItem.specifications || null,
          locationNote: updatedItem.locationNote || 'Ana Depo',
        },
      });
    }

    return updatedItem;
    });
  }

  public static async reconcilePhysicalCount(stockItemId: string, data: { countedAvailable: number; notes?: string; createdById?: string; requestKey?: string }) {
    const countedAvailable = Number(data.countedAvailable);
    if (!Number.isInteger(countedAvailable) || countedAvailable < 0) throw new AppError('Fiziksel sayım miktarı negatif olmayan tam sayı olmalıdır.', 400);
    return prisma.$transaction(async (tx) => {
      if (data.requestKey) {
        const prior = await tx.stockMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (prior) {
          if (prior.stockItemId !== stockItemId || prior.type !== 'ADJUSTMENT' || (prior.createdById || null) !== (data.createdById || null)) throw new AppError('Tekrar-gönderim anahtarı farklı bir stok işleminde kullanılmış.', 409);
          const priorItem = await tx.stockItem.findUniqueOrThrow({ where: { id: stockItemId } });
          const currentAvailable = priorItem.totalStock - priorItem.usedStock - priorItem.usedInRooms;
          return { item: priorItem, previousAvailable: currentAvailable - prior.quantity, countedAvailable: currentAvailable, difference: prior.quantity };
        }
      }
      await tx.$queryRaw`SELECT "id" FROM "StockItem" WHERE "id" = ${stockItemId} FOR UPDATE`;
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      if (sharedAssetItemTypes.has(item.itemType)) throw new AppError('Ortak eşya sayımı ortak eşya yaşam döngüsünden yönetilmelidir.', 409);
      const currentAvailable = item.totalStock - item.usedStock - item.usedInRooms;
      const difference = countedAvailable - currentAvailable;
      const notes = cleanOptional(data.notes, 'Sayım açıklaması', 1000);
      if (difference !== 0 && !notes) throw new AppError('Stok sayımında fark varsa açıklama zorunludur.', 400);
      const newTotal = item.usedStock + item.usedInRooms + countedAvailable;
      const updated = await tx.stockItem.update({
        where: { id: item.id },
        data: { totalStock: newTotal, lastCountedAt: new Date() },
      });
      await tx.stockMovement.create({ data: {
        requestKey: data.requestKey || null, stockItemId: item.id, type: 'ADJUSTMENT', quantity: difference,
        itemNameSnapshot: item.itemName, reason: 'FİZİKSEL SAYIM MUTABAKATI',
        notes: notes || `SİSTEM: ${currentAvailable} / FİZİKSEL: ${countedAvailable} / FARK YOK`,
        createdById: data.createdById,
      } });
      return { item: updated, previousAvailable: currentAvailable, countedAvailable, difference };
    });
  }

  public static async deleteStockItem(stockItemId: string) {
    const item = await prisma.stockItem.findUnique({ where: { id: stockItemId }, include: { _count: { select: { movements: true, roomInventories: true, inventories: true } } } });
    if (!item) throw new AppError('Stok kartı bulunamadı.', 404);
    if (item.totalStock > 0 || item._count.movements > 0 || item._count.roomInventories > 0 || item._count.inventories > 0) {
      throw new AppError('Hareket geçmişi veya bakiyesi bulunan stok kartı silinemez; pasife alınabilir.', 409);
    }
    return prisma.stockItem.delete({ where: { id: stockItemId } });
  }

  public static async getExportData(maxRows = config.stock.exportMaxRows) {
    const [items, roomAssignments, personnelAssignments, movements] = await Promise.all([
      prisma.stockItem.count(), prisma.roomInventory.count(), prisma.inventoryItem.count({ where: { isDeleted: false } }), prisma.stockMovement.count(),
    ]);
    const totalRows = items + roomAssignments + personnelAssignments + movements;
    if (totalRows > maxRows) throw new AppError(`Stok raporu toplam ${totalRows.toLocaleString('tr-TR')} satır içeriyor ve ${maxRows.toLocaleString('tr-TR')} satır sınırını aşıyor.`, 413);
    return prisma.stockItem.findMany({
      orderBy: { itemName: 'asc' },
      include: {
        roomInventories: { include: { room: { include: { block: true } } } },
        inventories: { where: { isDeleted: false }, include: { employee: { select: { firstName: true, lastName: true, registrationNo: true, department: true } } } },
        movements: { orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { fullName: true } }, employee: { select: { firstName: true, lastName: true, registrationNo: true } }, maintenance: { select: { id: true, title: true, type: true } } } },
      },
    });
  }

  public static async getDetailExportData(stockItemId: string, sections: string[], roomInventoryId?: string, maxRows = config.stock.exportMaxRows) {
    const item = await prisma.stockItem.findUnique({
      where: { id: stockItemId },
      include: {
        roomStandard: true,
        sharedAssets: { where: { status: { not: 'RETIRED' } }, select: { id: true } },
      },
    });
    if (!item) throw new AppError('Stok kartı bulunamadı.', 404);

    const scopedDevice = roomInventoryId ? await prisma.roomInventory.findFirst({
      where: { id: roomInventoryId, stockItemId },
      include: { room: { include: { block: true } } },
    }) : null;
    if (roomInventoryId && !scopedDevice) throw new AppError('Seçilen cihaz bu stok kartına ait değil.', 404);
    if (roomInventoryId && sections.some((section) => section === 'rooms' || section === 'coverage')) {
      throw new AppError('Tek cihaz raporunda oda dağılımı veya eksik oda kapsamı kullanılamaz.', 400);
    }

    const includeRooms = sections.includes('rooms');
    const includeCoverage = sections.includes('coverage');
    const includeFaults = sections.includes('faults');
    const includeMovements = sections.includes('movements');
    const roomWhere: Prisma.RoomInventoryWhereInput = { stockItemId, ...(roomInventoryId ? { id: roomInventoryId } : {}) };
    const faultWhere: Prisma.MaintenanceLogWhereInput = { type: 'ROOM_INVENTORY', roomInventory: { stockItemId }, ...(roomInventoryId ? { roomInventoryId } : {}) };
    const movementWhere: Prisma.StockMovementWhereInput = { stockItemId, ...(roomInventoryId ? { roomInventoryId } : {}) };

    const [roomCount, faultCount, movementCount] = await Promise.all([
      includeRooms ? prisma.roomInventory.count({ where: { ...roomWhere, returnedAt: null } }) : 0,
      includeFaults ? prisma.maintenanceLog.count({ where: faultWhere }) : 0,
      includeMovements ? prisma.stockMovement.count({ where: movementWhere }) : 0,
    ]);

    let coverageRooms: Array<any> = [];
    if (includeCoverage && item.roomStandard) {
      coverageRooms = await prisma.room.findMany({
        where: { roomType: item.roomStandard.roomType },
        orderBy: [{ block: { name: 'asc' } }, { floor: 'asc' }, { roomNumber: 'asc' }],
        include: { block: true, inventories: { where: { stockItemId, returnedAt: null }, select: { quantity: true } } },
      });
    }
    const totalRows = (sections.includes('summary') ? 1 : 0) + roomCount + faultCount + movementCount + coverageRooms.length;
    if (totalRows > maxRows) throw new AppError(`Seçilen rapor kapsamı ${totalRows.toLocaleString('tr-TR')} satır içeriyor ve ${maxRows.toLocaleString('tr-TR')} satır sınırını aşıyor. Kapsamı daraltın.`, 413);

    const [roomAssignments, faults, movements] = await Promise.all([
      includeRooms ? prisma.roomInventory.findMany({
        where: { ...roomWhere, returnedAt: null }, orderBy: [{ room: { block: { name: 'asc' } } }, { room: { roomNumber: 'asc' } }, { itemName: 'asc' }],
        include: { room: { include: { block: true } } },
      }) : [],
      includeFaults ? prisma.maintenanceLog.findMany({
        where: faultWhere, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { room: { include: { block: true } }, roomInventory: { select: { id: true, itemName: true, brand: true, quantity: true } } },
      }) : [],
      includeMovements ? prisma.stockMovement.findMany({
        where: movementWhere, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { createdBy: { select: { fullName: true } }, employee: { select: { firstName: true, lastName: true, registrationNo: true } }, maintenance: { select: { id: true, title: true } } },
      }) : [],
    ]);

    const activeRoomQuantity = await prisma.roomInventory.aggregate({ where: { stockItemId, returnedAt: null }, _sum: { quantity: true } });
    const effectiveUsedInRooms = Math.max(item.usedInRooms, activeRoomQuantity._sum.quantity || 0);
    const availableStock = Math.max(0, item.totalStock - item.usedStock - effectiveUsedInRooms - item.sharedAssets.length);
    const coverage = item.roomStandard ? coverageRooms.map((room) => {
      const required = item.roomStandard!.fixedQuantity + (item.roomStandard!.quantityPerBed * room.capacity);
      const assigned = room.inventories.reduce((sum: number, entry: { quantity: number }) => sum + entry.quantity, 0);
      return { roomId: room.id, blockName: room.block.name, roomNumber: room.roomNumber, floor: room.floor, capacity: room.capacity, required, assigned, missing: Math.max(0, required - assigned) };
    }).filter((room) => room.missing > 0) : [];

    return { item: { ...item, availableStock }, device: scopedDevice, roomAssignments, coverage, faults, movements };
  }
}
