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
  'BAHÇE & PEYZAJ', 'DİĞER',
]);

const cleanOptional = (value?: string | null) => value?.trim() ? value.trim().toLocaleUpperCase('tr-TR') : null;
const positiveInteger = (value: unknown, field: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError(`${field} sıfırdan büyük tam sayı olmalıdır.`, 400);
  return parsed;
};

const roomLabel = (room: { roomNumber: string; block: { name: string } }) => `${room.block.name} / ODA ${room.roomNumber}`;

export class StockService {
  public static async getOverview() {
    const [items, rooms, movements] = await Promise.all([
      prisma.stockItem.findMany({
        orderBy: [{ isActive: 'desc' }, { itemName: 'asc' }],
        include: {
          roomInventories: {
            where: { returnedAt: null },
            orderBy: { installedAt: 'desc' },
            include: { room: { include: { block: true } } },
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
        select: { id: true, roomNumber: true, floor: true, status: true, block: { select: { id: true, name: true } } },
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
    itemName: string; itemCode?: string; category?: string; unit?: string;
    minimumStock?: number; totalStock?: number; createdById?: string;
  }) {
    const itemName = normalizeInventoryItemName(data.itemName);
    if (!itemName) throw new AppError('Stok kalemi adı zorunludur.', 400);
    const itemCode = cleanOptional(data.itemCode);
    const category = cleanOptional(data.category) || 'GENEL';
    if (!stockCategories.has(category)) throw new AppError('Geçersiz stok kategorisi seçildi.', 400);
    const totalStock = Number(data.totalStock || 0);
    const minimumStock = Number(data.minimumStock ?? 5);
    if (!Number.isInteger(totalStock) || totalStock < 0) throw new AppError('Başlangıç miktarı negatif olamaz.', 400);
    if (!Number.isInteger(minimumStock) || minimumStock < 0) throw new AppError('Kritik stok seviyesi negatif olamaz.', 400);

    const duplicate = await prisma.stockItem.findFirst({
      where: { OR: [{ itemName }, ...(itemCode ? [{ itemCode }] : [])] },
    });
    if (duplicate) throw new AppError('Aynı ad veya stok koduyla kayıtlı bir stok kartı bulunuyor.', 409);

    return prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          itemName, itemCode, totalStock, minimumStock,
          category,
          unit: cleanOptional(data.unit) || 'ADET',
        },
      });
      if (totalStock > 0) {
        await tx.stockMovement.create({ data: {
          stockItemId: item.id, type: 'OPENING', quantity: totalStock,
          itemNameSnapshot: item.itemName, reason: 'AÇILIŞ STOKU', createdById: data.createdById,
        } });
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
      const available = item.totalStock - item.usedStock - item.usedInRooms;
      if (available < quantity) throw new AppError(`Yetersiz müsait stok. Depoda ${available} ${item.unit} bulunuyor.`, 409);

      const serialNo = cleanOptional(data.serialNo);
      if (serialNo) {
        const duplicateSerial = await tx.roomInventory.findFirst({ where: { serialNo, returnedAt: null } });
        if (duplicateSerial) throw new AppError('Bu seri numarası halen başka bir oda zimmetinde kullanılıyor.', 409);
      }

      const assignment = await tx.roomInventory.create({ data: {
        roomId: room.id, stockItemId: item.id, itemName: item.itemName,
        brand: cleanOptional(data.brand), serialNo, quantity, status: 'HEALTHY', notes: cleanOptional(data.notes),
      } });
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

  public static async returnFromRoom(inventoryId: string, data: {
    outcome: 'RETURNED' | 'RETIRED'; notes?: string; createdById?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      const isRetired = data.outcome !== 'RETURNED';
      const status: RoomInventoryStatus = 'RETIRED';
      const updated = await tx.roomInventory.update({ where: { id: inventoryId }, data: {
        status, returnedAt: new Date(), notes: cleanOptional(data.notes) ?? assignment.notes,
      } });
      await releaseRoomStock(tx, assignment.stockItem.id, assignment.quantity, isRetired);
      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItem.id, roomId: assignment.roomId, roomInventoryId: assignment.id,
        type: isRetired ? 'RETIREMENT' : 'ROOM_RETURN', quantity: isRetired ? -assignment.quantity : assignment.quantity,
        itemNameSnapshot: assignment.itemName, roomLabelSnapshot: roomLabel(assignment.room),
        brand: assignment.brand, serialNo: assignment.serialNo, reason: data.outcome,
        notes: cleanOptional(data.notes), createdById: data.createdById,
      } });
      return updated;
    });
  }

  public static async transferRoom(inventoryId: string, data: { roomId: string; notes?: string; createdById?: string }) {
    return prisma.$transaction(async (tx) => {
      const [assignment, targetRoom] = await Promise.all([
        tx.roomInventory.findUnique({ where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } } }),
        tx.room.findUnique({ where: { id: data.roomId }, include: { block: true } }),
      ]);
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      if (!targetRoom) throw new AppError('Hedef oda bulunamadı.', 404);
      if (assignment.roomId === targetRoom.id) throw new AppError('Hedef oda mevcut odadan farklı olmalıdır.', 400);
      const sourceLabel = roomLabel(assignment.room);
      const updated = await tx.roomInventory.update({ where: { id: inventoryId }, data: { roomId: targetRoom.id, notes: cleanOptional(data.notes) ?? assignment.notes } });
      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItem.id, roomId: targetRoom.id, roomInventoryId: assignment.id,
        type: 'ROOM_TRANSFER', quantity: 0, itemNameSnapshot: assignment.itemName,
        roomLabelSnapshot: `${sourceLabel} → ${roomLabel(targetRoom)}`, brand: assignment.brand,
        serialNo: assignment.serialNo, reason: 'ODA DEĞİŞİMİ', notes: cleanOptional(data.notes), createdById: data.createdById,
      } });
      return updated;
    });
  }

  public static async replaceAssignment(inventoryId: string, data: { brand?: string; serialNo?: string; notes?: string; createdById?: string }) {
    return prisma.$transaction(async (tx) => {
      const assignment = await tx.roomInventory.findUnique({
        where: { id: inventoryId }, include: { stockItem: true, room: { include: { block: true } } },
      });
      if (!assignment || assignment.returnedAt || !assignment.stockItem) throw new AppError('Aktif oda zimmeti bulunamadı.', 404);
      const available = assignment.stockItem.totalStock - assignment.stockItem.usedStock - assignment.stockItem.usedInRooms;
      if (available < assignment.quantity) throw new AppError('Değişim için depoda yeterli sağlam ürün bulunmuyor.', 409);

      await tx.roomInventory.update({ where: { id: assignment.id }, data: { status: 'RETIRED', returnedAt: new Date(), notes: cleanOptional(data.notes) ?? assignment.notes } });
      const retired = await tx.stockItem.updateMany({
        where: { id: assignment.stockItem.id, totalStock: { gte: assignment.quantity } },
        data: { totalStock: { decrement: assignment.quantity } },
      });
      if (retired.count !== 1) throw new AppError('Değişim sırasında stok bakiyesi güncellenemedi.', 409);
      const replacement = await tx.roomInventory.create({ data: {
        roomId: assignment.roomId, stockItemId: assignment.stockItem.id, itemName: assignment.itemName,
        brand: cleanOptional(data.brand), serialNo: cleanOptional(data.serialNo), quantity: assignment.quantity,
        status: 'HEALTHY', notes: cleanOptional(data.notes),
      } });
      await tx.stockMovement.create({ data: {
        stockItemId: assignment.stockItem.id, roomId: assignment.roomId, roomInventoryId: replacement.id,
        type: 'REPLACEMENT', quantity: -assignment.quantity, itemNameSnapshot: assignment.itemName,
        roomLabelSnapshot: roomLabel(assignment.room), brand: replacement.brand, serialNo: replacement.serialNo,
        reason: 'ARIZALI ÜRÜN DEĞİŞİMİ', notes: cleanOptional(data.notes), createdById: data.createdById,
      } });
      return replacement;
    });
  }

  public static async updateStockItem(stockItemId: string, data: {
    itemName?: string; itemCode?: string; category?: string; unit?: string;
    minimumStock?: number; isActive?: boolean;
  }) {
    const existing = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!existing) throw new AppError('Stok kartı bulunamadı.', 404);
    const minimumStock = data.minimumStock === undefined ? undefined : Number(data.minimumStock);
    if (minimumStock !== undefined && (!Number.isInteger(minimumStock) || minimumStock < 0)) throw new AppError('Kritik stok seviyesi geçersiz.', 400);
    const category = data.category === undefined ? undefined : (cleanOptional(data.category) || 'GENEL');
    if (category !== undefined && !stockCategories.has(category)) throw new AppError('Geçersiz stok kategorisi seçildi.', 400);
    return prisma.stockItem.update({ where: { id: stockItemId }, data: {
      ...(data.itemName !== undefined && { itemName: normalizeInventoryItemName(data.itemName) || existing.itemName }),
      ...(data.itemCode !== undefined && { itemCode: cleanOptional(data.itemCode) }),
      ...(category !== undefined && { category }),
      ...(data.unit !== undefined && { unit: cleanOptional(data.unit) || 'ADET' }),
      ...(minimumStock !== undefined && { minimumStock }),
      ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) }),
    } });
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
