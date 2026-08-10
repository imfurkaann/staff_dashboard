import { RoomInventoryStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { normalizeInventoryItemName } from '../utils/normalization';
import { releaseRoomStock, reserveRoomStock } from '../utils/stockBalance';

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

const cleanOptional = (value?: string | null) => value?.trim() ? value.trim().toLocaleUpperCase('tr-TR') : null;
const allowedItemTypes = new Set(['DEMİRBAŞ', 'SARF_MALZEME', 'ORTAK_EKİPMAN', 'ORTAK_KULLANIM']);
const positiveInteger = (value: unknown, field: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError(`${field} sıfırdan büyük tam sayı olmalıdır.`, 400);
  return parsed;
};

const optionalDate = (value: string | Date | null | undefined, field: string) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AppError(`${field} geçerli bir tarih olmalıdır.`, 400);
  return parsed;
};

const roomLabel = (room: { roomNumber: string; block: { name: string } }) => `${room.block.name} / ODA ${room.roomNumber}`;
const assetTagFor = (itemCode: string | null, id: string) => `${itemCode || 'ENV'}-${id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;

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

  public static async getOverview() {
    const [items, rooms, movements] = await Promise.all([
      prisma.stockItem.findMany({
        orderBy: [{ isActive: 'desc' }, { itemName: 'asc' }],
        include: {
          roomInventories: {
            where: { returnedAt: null },
            orderBy: { installedAt: 'desc' },
            include: {
              room: { include: { block: true } },
              maintenances: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true, status: true } },
            },
          },
          inventories: {
            where: { returnedDate: null },
            orderBy: { assignedDate: 'desc' },
            include: { employee: { select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true } } },
          },
          _count: { select: { movements: true } },
        },
      }),
      prisma.room.findMany({
        orderBy: [{ block: { name: 'asc' } }, { floor: 'asc' }, { roomNumber: 'asc' }],
        select: { id: true, roomNumber: true, roomType: true, floor: true, status: true, block: { select: { id: true, name: true } } },
      }),
      prisma.stockMovement.findMany({
        take: 80,
        orderBy: { createdAt: 'desc' },
        include: {
          stockItem: { select: { itemCode: true, unit: true } },
          createdBy: { select: { fullName: true } },
          employee: { select: { firstName: true, lastName: true, registrationNo: true } },
          maintenance: { select: { id: true, title: true, type: true } },
        },
      }),
    ]);

    const enriched = items.map((item) => ({
      ...item,
      availableStock: Math.max(0, item.totalStock - item.usedStock - item.usedInRooms),
      serviceCount: item.roomInventories.filter((entry) => entry.status === 'IN_SERVICE').reduce((sum, entry) => sum + entry.quantity, 0),
      issueCount: item.roomInventories.filter((entry) => ['MAINTENANCE_REQUIRED', 'DAMAGED', 'LOST', 'REPLACEMENT_REQUIRED'].includes(entry.status)).reduce((sum, entry) => sum + entry.quantity, 0),
    }));

    const summary = enriched.reduce((result, item) => {
      result.totalRegistered += item.totalStock;
      result.available += item.availableStock;
      result.inRooms += item.usedInRooms;
      result.inService += item.serviceCount;
      result.issues += item.issueCount;
      if (item.isActive && item.availableStock <= item.minimumStock) result.criticalCards++;
      return result;
    }, { totalRegistered: 0, available: 0, inRooms: 0, inService: 0, issues: 0, criticalCards: 0 });

    return { items: enriched, rooms, movements, summary };
  }

  public static async createStockItem(data: {
    itemName: string; itemCode?: string; category?: string; itemType?: string; unit?: string;
    specifications?: string; physicalStatus?: string; warrantyEndDate?: string | Date | null;
    locationNote?: string; minimumStock?: number; totalStock?: number; createdById?: string;
  }) {
    const itemName = normalizeInventoryItemName(data.itemName);
    if (!itemName) throw new AppError('Stok kalemi adı zorunludur.', 400);
    const category = cleanOptional(data.category) || 'GENEL';
    if (!stockCategories.has(category)) throw new AppError('Geçersiz stok kategorisi seçildi.', 400);

    let itemCode = cleanOptional(data.itemCode);
    if (!itemCode) {
      itemCode = await this.generateNextItemCode(category);
    }

    const itemType = cleanOptional(data.itemType) || 'DEMİRBAŞ';
    if (!allowedItemTypes.has(itemType)) throw new AppError('Geçersiz stok kalemi tipi.', 400);
    const physicalStatus = cleanOptional(data.physicalStatus) || 'KULLANILABİLİR';
    const specifications = cleanOptional(data.specifications);
    const locationNote = cleanOptional(data.locationNote);
    const warrantyEndDate = optionalDate(data.warrantyEndDate, 'Garanti bitiş tarihi') ?? null;

    let totalStock = Number(data.totalStock || 0);
    if ((itemType === 'ORTAK_EKİPMAN' || itemType === 'ORTAK_KULLANIM') && totalStock === 0) {
      totalStock = 1;
    }
    const minimumStock = Number(data.minimumStock ?? 1);
    if (!Number.isInteger(totalStock) || totalStock < 0) throw new AppError('Başlangıç miktarı negatif olamaz.', 400);
    if (!Number.isInteger(minimumStock) || minimumStock < 0) throw new AppError('Kritik stok seviyesi negatif olamaz.', 400);

    const duplicate = await prisma.stockItem.findFirst({
      where: { OR: [{ itemName }, ...(itemCode ? [{ itemCode }] : [])] },
    });
    if (duplicate) throw new AppError('Aynı ad veya stok koduyla kayıtlı bir stok kartı bulunuyor.', 409);

    return prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          itemName, itemCode, category, itemType, specifications, physicalStatus,
          warrantyEndDate, locationNote, totalStock, minimumStock,
          unit: cleanOptional(data.unit) || 'ADET',
        },
      });
      if (totalStock > 0) {
        await tx.stockMovement.create({ data: {
          stockItemId: item.id, type: 'OPENING', quantity: totalStock,
          itemNameSnapshot: item.itemName, reason: 'AÇILIŞ STOKU', createdById: data.createdById,
        } });
      }

      if (itemType === 'ORTAK_EKİPMAN' || itemType === 'ORTAK_KULLANIM') {
        const existingAsset = await tx.sharedAsset.findFirst({ where: { OR: [{ assetCode: itemCode }, { assetName: itemName }] } });
        if (!existingAsset) {
          await tx.sharedAsset.create({
            data: {
              assetCode: itemCode || `ORT-${item.id.slice(0, 4)}`,
              assetName: itemName,
              category: category,
              brandModel: specifications || null,
              status: 'AVAILABLE',
              locationNote: locationNote || 'Ana Depo',
              warrantyEndDate: warrantyEndDate,
            },
          });
        }
      }

      return item;
    });
  }

  public static async receive(stockItemId: string, data: { quantity: number; reason?: string; notes?: string; createdById?: string }) {
    const quantity = positiveInteger(data.quantity, 'Giriş miktarı');
    return prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      const updated = await tx.stockItem.update({ where: { id: item.id }, data: { totalStock: { increment: quantity } } });
      await tx.stockMovement.create({ data: {
        stockItemId: item.id, type: 'RECEIPT', quantity, itemNameSnapshot: item.itemName,
        reason: cleanOptional(data.reason) || 'DEPO GİRİŞİ', notes: cleanOptional(data.notes), createdById: data.createdById,
      } });
      return updated;
    });
  }

  public static async assignToRoom(stockItemId: string, data: {
    roomId: string; quantity: number; brand?: string; serialNo?: string; notes?: string; createdById?: string;
  }) {
    const quantity = positiveInteger(data.quantity, 'Zimmet miktarı');
    return prisma.$transaction(async (tx) => {
      const [item, room] = await Promise.all([
        tx.stockItem.findUnique({ where: { id: stockItemId } }),
        tx.room.findUnique({ where: { id: data.roomId }, include: { block: true } }),
      ]);
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      if (!room) throw new AppError('Oda bulunamadı.', 404);
      if (item.itemType !== 'SARF_MALZEME' && quantity > 1) throw new AppError('Demirbaşlar cihaz geçmişinin korunması için tek tek ve 1 adet olarak zimmetlenmelidir.', 400);
      const available = item.totalStock - item.usedStock - item.usedInRooms;
      if (available < quantity) throw new AppError(`Yetersiz müsait stok. Depoda ${available} ${item.unit} bulunuyor.`, 409);

      const serialNo = cleanOptional(data.serialNo);
      if (item.itemType !== 'SARF_MALZEME' && !serialNo) throw new AppError('Demirbaş zimmeti için cihazın üretici seri numarası zorunludur.', 400);
      if (serialNo) {
        const duplicateSerial = await tx.roomInventory.findFirst({ where: { serialNo, returnedAt: null } });
        if (duplicateSerial) throw new AppError('Bu seri numarası halen başka bir oda zimmetinde kullanılıyor.', 409);
      }

      let assignment = await tx.roomInventory.create({ data: {
        roomId: room.id, stockItemId: item.id, itemName: item.itemName,
        brand: cleanOptional(data.brand), serialNo, quantity, status: 'HEALTHY', notes: cleanOptional(data.notes),
      } });
      assignment = await tx.roomInventory.update({ where: { id: assignment.id }, data: { assetTag: assetTagFor(item.itemCode, assignment.id) } });
      await reserveRoomStock(tx, item.id, quantity);
      await tx.stockMovement.create({ data: {
        stockItemId: item.id, roomId: room.id, roomInventoryId: assignment.id,
        type: 'ROOM_ASSIGNMENT', quantity: -quantity, itemNameSnapshot: item.itemName,
        roomLabelSnapshot: roomLabel(room), brand: assignment.brand, serialNo: assignment.serialNo,
        reason: 'ODAYA ZİMMET', notes: assignment.notes, createdById: data.createdById,
      } });
      return assignment;
    });
  }

  public static async assignToRooms(stockItemId: string, data: {
    roomIds: string[]; quantityPerRoom: number; brand?: string; notes?: string; createdById?: string;
  }) {
    const quantityPerRoom = positiveInteger(data.quantityPerRoom, 'Oda başına zimmet miktarı');
    const roomIds = Array.from(new Set(Array.isArray(data.roomIds) ? data.roomIds : []));
    if (roomIds.length === 0) throw new AppError('En az bir hedef oda seçilmelidir.', 400);
    if (roomIds.length > 500) throw new AppError('Tek işlemde en fazla 500 odaya zimmet yapılabilir.', 400);
    const totalQuantity = roomIds.length * quantityPerRoom;

    return prisma.$transaction(async (tx) => {
      const [item, rooms] = await Promise.all([
        tx.stockItem.findUnique({ where: { id: stockItemId } }),
        tx.room.findMany({
          where: { id: { in: roomIds } },
          include: { block: true },
          orderBy: [{ block: { name: 'asc' } }, { floor: 'asc' }, { roomNumber: 'asc' }],
        }),
      ]);
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      if (item.itemType !== 'SARF_MALZEME') throw new AppError('Demirbaşlar benzersiz seri numarasıyla tek tek zimmetlenmelidir; toplu dağıtım yalnızca sarf malzemelerinde kullanılabilir.', 400);
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
          brand: cleanOptional(data.brand),
          quantity: quantityPerRoom,
          status: 'HEALTHY',
          notes: cleanOptional(data.notes),
        } });
        assignment = await tx.roomInventory.update({ where: { id: assignment.id }, data: { assetTag: assetTagFor(item.itemCode, assignment.id) } });
        await tx.stockMovement.create({ data: {
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
    outcome: 'RETURNED' | 'RETIRED'; notes?: string; createdById?: string;
  }) {
    if (!['RETURNED', 'RETIRED'].includes(data.outcome)) throw new AppError('Geçersiz iade sonucu.', 400);
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('İade veya düşüm gerekçesi zorunludur.', 400);
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      const activeFault = await tx.maintenanceLog.findFirst({ where: { roomInventoryId: assignment.id, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true } });
      if (activeFault) throw new AppError('Bu cihazın açık arıza süreci var. Depoya iade etmeden önce Arıza Yönetimi üzerinden süreci sonuçlandırın.', 409);
      const isRetired = data.outcome !== 'RETURNED';
      const status: RoomInventoryStatus = 'RETIRED';
      const changed = await tx.roomInventory.updateMany({ where: { id: inventoryId, returnedAt: null }, data: {
        status, returnedAt: new Date(), notes: processNote,
      } });
      if (changed.count !== 1) throw new AppError('Zimmet başka bir işlemde değişti. Güncel listeyi yenileyin.', 409);
      await releaseRoomStock(tx, assignment.stockItem.id, assignment.quantity, isRetired);
      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItem.id, roomId: assignment.roomId, roomInventoryId: assignment.id,
        type: isRetired ? 'RETIREMENT' : 'ROOM_RETURN', quantity: isRetired ? -assignment.quantity : assignment.quantity,
        itemNameSnapshot: assignment.itemName, roomLabelSnapshot: roomLabel(assignment.room),
        brand: assignment.brand, serialNo: assignment.serialNo, reason: data.outcome,
        notes: processNote, createdById: data.createdById,
      } });
      return tx.roomInventory.findUniqueOrThrow({ where: { id: inventoryId } });
    });
  }

  public static async transferRoom(inventoryId: string, data: { roomId: string; notes?: string; createdById?: string }) {
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('Oda transfer gerekçesi zorunludur.', 400);
    return prisma.$transaction(async (tx) => {
      const [assignment, targetRoom] = await Promise.all([
        tx.roomInventory.findUnique({ where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } } }),
        tx.room.findUnique({ where: { id: data.roomId }, include: { block: true } }),
      ]);
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      if (!targetRoom) throw new AppError('Hedef oda bulunamadı.', 404);
      if (assignment.roomId === targetRoom.id) throw new AppError('Hedef oda mevcut odadan farklı olmalıdır.', 400);
      const activeFault = await tx.maintenanceLog.findFirst({ where: { roomInventoryId: assignment.id, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true } });
      if (activeFault) throw new AppError('Açık arıza kaydı bulunan cihaz transfer edilemez. Önce Arıza Yönetimi sürecini sonuçlandırın.', 409);
      const sourceLabel = roomLabel(assignment.room);
      const changed = await tx.roomInventory.updateMany({ where: { id: inventoryId, roomId: assignment.roomId, returnedAt: null }, data: { roomId: targetRoom.id, notes: processNote } });
      if (changed.count !== 1) throw new AppError('Zimmet başka bir işlemde değişti. Güncel listeyi yenileyin.', 409);
      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItem.id, roomId: targetRoom.id, roomInventoryId: assignment.id,
        type: 'ROOM_TRANSFER', quantity: 0, itemNameSnapshot: assignment.itemName,
        roomLabelSnapshot: `${sourceLabel} → ${roomLabel(targetRoom)}`, brand: assignment.brand,
        serialNo: assignment.serialNo, reason: 'ODA DEĞİŞİMİ', notes: processNote, createdById: data.createdById,
      } });
      return tx.roomInventory.findUniqueOrThrow({ where: { id: inventoryId } });
    });
  }

  public static async updateAssignmentIdentity(inventoryId: string, data: { brand?: string; serialNo?: string; notes?: string; createdById?: string }) {
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('Cihaz kimliği değişiklik gerekçesi zorunludur.', 400);

    return prisma.$transaction(async (tx) => {
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId },
        include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);

      const serialNo = cleanOptional(data.serialNo);
      if (assignment.stockItem.itemType !== 'SARF_MALZEME' && !serialNo) {
        throw new AppError('Demirbaş için üretici seri numarası zorunludur.', 400);
      }
      if (serialNo) {
        const duplicate = await tx.roomInventory.findFirst({ where: { serialNo, returnedAt: null, NOT: { id: assignment.id } }, select: { id: true } });
        if (duplicate) throw new AppError('Bu seri numarası başka bir aktif demirbaşta kullanılıyor.', 409);
      }

      const brand = cleanOptional(data.brand);
      const changed = await tx.roomInventory.updateMany({
        where: { id: assignment.id, returnedAt: null, updatedAt: assignment.updatedAt },
        data: { brand, serialNo, notes: processNote },
      });
      if (changed.count !== 1) throw new AppError('Zimmet başka bir kullanıcı tarafından güncellendi. Listeyi yenileyip tekrar deneyin.', 409);

      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItemId,
        roomId: assignment.roomId,
        roomInventoryId: assignment.id,
        type: 'STATUS_CHANGE',
        quantity: 0,
        itemNameSnapshot: assignment.itemName,
        roomLabelSnapshot: roomLabel(assignment.room),
        brand,
        serialNo,
        reason: 'CİHAZ KİMLİK BİLGİSİ GÜNCELLEMESİ',
        notes: `${processNote} / ÖNCEKİ SERİ NO: ${assignment.serialNo || 'KAYITLI DEĞİL'} / ÖNCEKİ MARKA: ${assignment.brand || 'KAYITLI DEĞİL'}`,
        createdById: data.createdById,
      } });

      return tx.roomInventory.findUniqueOrThrow({ where: { id: assignment.id } });
    });
  }

  public static async replaceAssignment(inventoryId: string, data: { brand?: string; serialNo?: string; notes?: string; createdById?: string; performedBy?: string }) {
    const processNote = cleanOptional(data.notes);
    if (!processNote) throw new AppError('Cihaz değişim gerekçesi ve yapılan işlem açıklaması zorunludur.', 400);
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      const activeFault = await tx.maintenanceLog.findFirst({ where: { roomInventoryId: assignment.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } });
      if (!activeFault) throw new AppError('Cihaz değişimi için önce Arıza Yönetimi sayfasından aktif bir demirbaş arızası açılmalıdır.', 409);
      const replacementSerialNo = cleanOptional(data.serialNo);
      if (assignment.stockItem.itemType !== 'SARF_MALZEME' && !replacementSerialNo) throw new AppError('Yeni demirbaş için üretici seri numarası zorunludur.', 400);
      if (replacementSerialNo) {
        const duplicate = await tx.roomInventory.findFirst({ where: { serialNo: replacementSerialNo, returnedAt: null, NOT: { id: assignment.id } } });
        if (duplicate) throw new AppError('Bu seri numarası halen başka bir aktif demirbaşta kullanılıyor.', 409);
      }
      const available = assignment.stockItem.totalStock - assignment.stockItem.usedStock - assignment.stockItem.usedInRooms;
      if (available < assignment.quantity) throw new AppError('Değişim için depoda yeterli sağlam ürün bulunmuyor.', 409);

      const retiredAssignment = await tx.roomInventory.updateMany({ where: { id: assignment.id, returnedAt: null }, data: { status: 'RETIRED', returnedAt: new Date(), notes: processNote } });
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
        brand: cleanOptional(data.brand), serialNo: replacementSerialNo, quantity: assignment.quantity,
        status: 'HEALTHY', notes: processNote,
      } });
      replacement = await tx.roomInventory.update({ where: { id: replacement.id }, data: { assetTag: assetTagFor(assignment.stockItem.itemCode, replacement.id) } });
      const resolution = `${processNote} / ARIZALI CİHAZ: ${assignment.serialNo || assignment.assetTag || assignment.id} / YENİ CİHAZ: ${replacement.serialNo || replacement.assetTag}`;
      await tx.maintenanceLog.update({ where: { id: activeFault.id }, data: { status: 'RESOLVED', resolvedAt: new Date(), resolutionNote: resolution, assignedTo: cleanOptional(data.performedBy) || activeFault.assignedTo || 'DEPO YÖNETİMİ' } });
      await tx.maintenanceEvent.create({ data: { maintenanceId: activeFault.id, action: 'DEVICE_REPLACED', fromStatus: activeFault.status, toStatus: 'RESOLVED', inventoryStatus: 'RETIRED', notes: resolution, performedBy: cleanOptional(data.performedBy) || 'DEPO YÖNETİMİ' } });
      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItem.id, roomId: assignment.roomId, roomInventoryId: replacement.id,
        type: 'REPLACEMENT', quantity: -assignment.quantity, itemNameSnapshot: assignment.itemName,
        roomLabelSnapshot: roomLabel(assignment.room), brand: replacement.brand, serialNo: replacement.serialNo,
        maintenanceId: activeFault.id, reason: `ARIZALI ÜRÜN DEĞİŞİMİ / ESKİ: ${assignment.serialNo || assignment.assetTag || assignment.id}`, notes: resolution, createdById: data.createdById,
      } });
      return replacement;
    });
  }

  public static async updateStockItem(stockItemId: string, data: {
    itemName?: string; itemCode?: string; category?: string; itemType?: string; unit?: string;
    specifications?: string; physicalStatus?: string; warrantyEndDate?: string | Date | null;
    locationNote?: string; minimumStock?: number; isActive?: boolean;
  }) {
    const existing = await prisma.stockItem.findUnique({ where: { id: stockItemId }, include: { _count: { select: { movements: true, roomInventories: true, inventories: true } } } });
    if (!existing) throw new AppError('Stok kartı bulunamadı.', 404);
    const minimumStock = data.minimumStock === undefined ? undefined : Number(data.minimumStock);
    if (minimumStock !== undefined && (!Number.isInteger(minimumStock) || minimumStock < 0)) throw new AppError('Kritik stok seviyesi geçersiz.', 400);
    const category = data.category === undefined ? undefined : (cleanOptional(data.category) || 'GENEL');
    if (category !== undefined && !stockCategories.has(category)) throw new AppError('Geçersiz stok kategorisi seçildi.', 400);
    const nextItemType = data.itemType === undefined ? existing.itemType : (cleanOptional(data.itemType) || 'DEMİRBAŞ');
    if (!allowedItemTypes.has(nextItemType)) throw new AppError('Geçersiz stok kalemi tipi.', 400);
    if (nextItemType !== existing.itemType && (existing._count.movements > 0 || existing._count.roomInventories > 0 || existing._count.inventories > 0)) {
      throw new AppError('Hareket veya zimmet geçmişi bulunan stok kartının tipi değiştirilemez. Yeni bir stok kartı açılmalıdır.', 409);
    }
    const nextItemCode = data.itemCode === undefined ? existing.itemCode : cleanOptional(data.itemCode);
    if (nextItemCode !== existing.itemCode && existing._count.movements > 0) throw new AppError('Hareket geçmişi bulunan stok kartının kodu değiştirilemez.', 409);
    const nextItemName = data.itemName === undefined ? existing.itemName : normalizeInventoryItemName(data.itemName);
    if (!nextItemName) throw new AppError('Stok kalemi adı zorunludur.', 400);
    if (nextItemName !== existing.itemName && existing._count.movements > 0) {
      throw new AppError('Hareket geçmişi bulunan stok kartının adı değiştirilemez. Kayıt düzeltmesi gerekiyorsa yeni stok kartı açılmalıdır.', 409);
    }
    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') throw new AppError('Stok kartı aktiflik bilgisi geçersiz.', 400);

    const warrantyEndDate = optionalDate(data.warrantyEndDate, 'Garanti bitiş tarihi');

    return prisma.$transaction(async (tx) => {
      const updatedItem = await tx.stockItem.update({ where: { id: stockItemId }, data: {
      ...(data.itemName !== undefined && { itemName: nextItemName }),
      ...(data.itemCode !== undefined && { itemCode: cleanOptional(data.itemCode) }),
      ...(category !== undefined && { category }),
      ...(data.itemType !== undefined && { itemType: nextItemType }),
      ...(data.unit !== undefined && { unit: cleanOptional(data.unit) || 'ADET' }),
      ...(data.specifications !== undefined && { specifications: cleanOptional(data.specifications) }),
      ...(data.physicalStatus !== undefined && { physicalStatus: cleanOptional(data.physicalStatus) || 'KULLANILABİLİR' }),
      ...(data.locationNote !== undefined && { locationNote: cleanOptional(data.locationNote) }),
      ...(warrantyEndDate !== undefined && { warrantyEndDate }),
      ...(minimumStock !== undefined && { minimumStock }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    } });

    if (updatedItem.itemType === 'ORTAK_EKİPMAN' || existing.itemType === 'ORTAK_EKİPMAN') {
      const orConditions: Array<{ assetCode?: string; assetName?: string }> = [
        { assetName: existing.itemName },
      ];
      if (existing.itemCode) orConditions.push({ assetCode: existing.itemCode });
      if (updatedItem.itemCode) orConditions.push({ assetCode: updatedItem.itemCode });

      await tx.sharedAsset.updateMany({
        where: { OR: orConditions },
        data: {
          assetName: updatedItem.itemName,
          category: updatedItem.category,
          brandModel: updatedItem.specifications || null,
          warrantyEndDate: updatedItem.warrantyEndDate || null,
          locationNote: updatedItem.locationNote || 'Ana Depo',
        },
      });
    }

    return updatedItem;
    });
  }

  public static async reconcilePhysicalCount(stockItemId: string, data: { countedAvailable: number; notes?: string; createdById?: string }) {
    const countedAvailable = Number(data.countedAvailable);
    if (!Number.isInteger(countedAvailable) || countedAvailable < 0) throw new AppError('Fiziksel sayım miktarı negatif olmayan tam sayı olmalıdır.', 400);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "StockItem" WHERE "id" = ${stockItemId} FOR UPDATE`;
      const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!item || !item.isActive) throw new AppError('Aktif stok kartı bulunamadı.', 404);
      const currentAvailable = item.totalStock - item.usedStock - item.usedInRooms;
      const difference = countedAvailable - currentAvailable;
      const newTotal = item.usedStock + item.usedInRooms + countedAvailable;
      const updated = await tx.stockItem.update({
        where: { id: item.id },
        data: { totalStock: newTotal, lastCountedAt: new Date() },
      });
      await tx.stockMovement.create({ data: {
        stockItemId: item.id, type: 'ADJUSTMENT', quantity: difference,
        itemNameSnapshot: item.itemName, reason: 'FİZİKSEL SAYIM MUTABAKATI',
        notes: cleanOptional(data.notes) || `SİSTEM: ${currentAvailable} / FİZİKSEL: ${countedAvailable}`,
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

  public static async getExportData() {
    return prisma.stockItem.findMany({
      orderBy: { itemName: 'asc' },
      include: {
        roomInventories: { include: { room: { include: { block: true } } } },
        inventories: { include: { employee: { select: { firstName: true, lastName: true, registrationNo: true, department: true } } } },
        movements: { orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { fullName: true } }, employee: { select: { firstName: true, lastName: true, registrationNo: true } }, maintenance: { select: { id: true, title: true, type: true } } } },
      },
    });
  }
}
