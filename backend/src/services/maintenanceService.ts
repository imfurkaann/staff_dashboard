import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { MaintenancePriority, MaintenanceStatus, MaintenanceType, Prisma, RoomInventoryStatus } from '@prisma/client';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { releaseRoomStock } from '../utils/stockBalance';
import { assertClosedMaintenanceEditable, assertMaintenanceTransition } from '../security/maintenancePolicy';

const inventoryFaultStatuses = new Set<RoomInventoryStatus>([
  'MAINTENANCE_REQUIRED',
  'DAMAGED',
  'LOST',
  'IN_SERVICE',
  'REPLACEMENT_REQUIRED',
]);

async function executeTransactionWithRetry<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      attempt++;
      const isSerializationError =
        error?.code === 'P2034' ||
        (typeof error?.message === 'string' &&
          (error.message.includes('serialization failure') ||
           error.message.includes('deadlock detected') ||
           error.message.includes('Transaction failed due to a write conflict')));
      if (isSerializationError && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 150));
        continue;
      }
      throw error;
    }
  }
}

async function syncRoomStatusForMaintenance(tx: Prisma.TransactionClient, roomId: string) {
  const room = await tx.room.findUnique({ where: { id: roomId }, select: { id: true, status: true } });
  if (!room) return;
  const remainingActiveHighFaults = await tx.maintenanceLog.count({
    where: {
      roomId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      priority: { in: ['HIGH', 'URGENT'] },
    },
  });
  if (remainingActiveHighFaults > 0) {
    if (room.status !== 'OUT_OF_ORDER') {
      await tx.room.update({ where: { id: roomId }, data: { status: 'OUT_OF_ORDER' } });
    }
  } else {
    if (room.status === 'OUT_OF_ORDER') {
      await tx.room.update({ where: { id: roomId }, data: { status: 'READY' } });
    }
  }
}

const maintenanceInclude = {
  room: {
    select: {
      id: true,
      roomNumber: true,
      floor: true,
      block: { select: { id: true, name: true } },
    },
  },
  roomInventory: {
    select: { id: true, assetTag: true, itemName: true, brand: true, serialNo: true, quantity: true, status: true, returnedAt: true },
  },
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
  events: {
    orderBy: { createdAt: 'desc' as const },
    take: 100,
    include: { performedByUser: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.MaintenanceLogInclude;

export interface MaintenanceFilterOptions {
  status?: MaintenanceStatus | 'ALL';
  priority?: MaintenancePriority | 'ALL';
  category?: string | 'ALL';
  blockId?: string;
  search?: string;
  dateStart?: string;
  dateEnd?: string;
  page?: number;
  pageSize?: number;
  exportMaxRows?: number;
}

export interface CreateMaintenanceInput {
  requestKey?: string;
  roomId?: string;
  type?: MaintenanceType;
  roomInventoryId?: string;
  inventoryStatus?: RoomInventoryStatus;
  title?: string;
  description: string;
  priority?: MaintenancePriority;
  category?: string;
  location?: string;
  reportedBy: string;
  assignedTo?: string;
  createdById?: string;
}

export interface UpdateMaintenanceInput {
  title?: string;
  description?: string;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  category?: string | null;
  location?: string | null;
  assignedTo?: string | null;
  resolutionNote?: string | null;
  inventoryStatus?: RoomInventoryStatus;
  serviceProvider?: string | null;
  serviceReference?: string | null;
  laborCost?: number;
  partsCost?: number;
  warrantyCovered?: boolean;
  sentToServiceAt?: string | Date | null;
  returnedFromServiceAt?: string | Date | null;
  performedBy: string;
  performedById?: string;
  canFullUpdate?: boolean;
}

export const maintenanceService = {
  /**
   * Get maintenance records with filters, summary statistics, and pagination support
   */
  async getMaintenances(filters: MaintenanceFilterOptions = {}) {
    const { status, priority, category, blockId, search, dateStart, dateEnd, page, pageSize, exportMaxRows } = filters;

    const whereCondition: Prisma.MaintenanceLogWhereInput = {};

    if (status && status !== 'ALL') {
      whereCondition.status = status;
    }

    if (priority && priority !== 'ALL') {
      whereCondition.priority = priority;
    }

    if (category && category !== 'ALL') {
      whereCondition.category = category;
    }

    if (blockId) {
      whereCondition.room = {
        blockId,
      };
    }

    if (dateStart || dateEnd) {
      const start = parseIstanbulDateBoundary(dateStart, false);
      const end = parseIstanbulDateBoundary(dateEnd, true);
      assertDateRange(start, end);
      whereCondition.createdAt = { ...(start && { gte: start }), ...(end && { lte: end }) };
    }

    if (search && search.trim() !== '') {
      const query = search.trim();
      whereCondition.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { reportedBy: { contains: query, mode: 'insensitive' } },
        { assignedTo: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
        { location: { contains: query, mode: 'insensitive' } },
        { inventorySerialNoSnapshot: { contains: query, mode: 'insensitive' } },
        { inventoryAssetTagSnapshot: { contains: query, mode: 'insensitive' } },
        { serviceProvider: { contains: query, mode: 'insensitive' } },
        { serviceReference: { contains: query, mode: 'insensitive' } },
        { room: { roomNumber: { contains: query, mode: 'insensitive' } } },
        { room: { block: { name: { contains: query, mode: 'insensitive' } } } },
      ];
    }

    // Scoped condition without status filter for status tab counts
    const baseScopedCondition: Prisma.MaintenanceLogWhereInput = { ...whereCondition };
    delete baseScopedCondition.status;

    // Scoped condition without priority filter for priority counts
    const baseScopedConditionForPriority: Prisma.MaintenanceLogWhereInput = { ...whereCondition };
    delete baseScopedConditionForPriority.priority;

    const currentPage = page && page > 0 ? Math.floor(page) : 1;
    const limit = exportMaxRows
      ? Math.min(Math.max(Math.floor(exportMaxRows), 1), 50_000)
      : (pageSize && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 25);
    const skip = (currentPage - 1) * limit;

    const [items, totalCount, openCount, inProgressCount, resolvedCount, closedCount, urgentCount] = await Promise.all([
      prisma.maintenanceLog.findMany({
        where: whereCondition,
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
        include: maintenanceInclude,
      }),
      prisma.maintenanceLog.count({ where: whereCondition }),
      prisma.maintenanceLog.count({ where: { ...baseScopedCondition, status: 'OPEN' } }),
      prisma.maintenanceLog.count({ where: { ...baseScopedCondition, status: 'IN_PROGRESS' } }),
      prisma.maintenanceLog.count({ where: { ...baseScopedCondition, status: 'RESOLVED' } }),
      prisma.maintenanceLog.count({ where: { ...baseScopedCondition, status: 'CLOSED' } }),
      prisma.maintenanceLog.count({
        where: {
          ...baseScopedConditionForPriority,
          priority: { in: ['HIGH', 'URGENT'] },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
    ]);

    const effectiveLimit = limit || totalCount || 1;
    if (exportMaxRows && totalCount > exportMaxRows) {
      throw new AppError(`Arıza raporu ${exportMaxRows.toLocaleString('tr-TR')} satır sınırını aşıyor. Filtreyi veya tarih aralığını daraltın.`, 413);
    }
    const totalPages = Math.ceil(totalCount / effectiveLimit) || 1;

    return {
      items,
      summary: {
        totalCount,
        openCount,
        inProgressCount,
        resolvedCount,
        closedCount,
        urgentCount,
      },
      pagination: {
        page: currentPage,
        pageSize: limit || totalCount,
        total: totalCount,
        totalPages,
      },
    };
  },

  /**
   * Create a new maintenance record
   */
  async createMaintenance(data: CreateMaintenanceInput) {
    const {
      requestKey,
      roomId,
      type = 'GENERAL',
      roomInventoryId,
      inventoryStatus,
      title,
      description,
      priority = 'MEDIUM',
      category,
      location,
      reportedBy,
      assignedTo,
      createdById,
    } = data;

    if (!roomId) throw new AppError('Arıza kaydı için oda seçilmelidir.', 400);
    const cleanDescription = description.trim().toLocaleUpperCase('tr-TR');
    if (!cleanDescription) throw new AppError('Arıza açıklaması zorunludur.', 400);
    if (type === 'GENERAL' && (roomInventoryId || inventoryStatus)) {
      throw new AppError('Genel oda arızasına demirbaş bilgisi bağlanamaz.', 400);
    }
    if (type === 'ROOM_INVENTORY' && (!roomInventoryId || !inventoryStatus)) {
      throw new AppError('Demirbaş arızası için oda demirbaşı ve demirbaş durumu seçilmelidir.', 400);
    }
    if (type === 'ROOM_INVENTORY' && !inventoryFaultStatuses.has(inventoryStatus!)) {
      throw new AppError('Seçilen durum yeni bir demirbaş arızası için kullanılamaz.', 400);
    }

    try {
      return await executeTransactionWithRetry(async (tx) => {
        if (requestKey) {
          const existingRequest = await tx.maintenanceLog.findUnique({ where: { requestKey }, include: maintenanceInclude });
          if (existingRequest) {
            if ((existingRequest.createdById || null) !== (createdById || null)) {
              throw new AppError('Bu tekrar-gönderim anahtarı başka bir işlemde kullanılmış.', 409);
            }
            const sameRequest = existingRequest.roomId === roomId
              && existingRequest.type === type
              && (existingRequest.roomInventoryId || null) === (roomInventoryId || null)
              && existingRequest.description === cleanDescription
              && existingRequest.priority === priority;
            if (!sameRequest) throw new AppError('Bu tekrar-gönderim anahtarı farklı bir arıza isteğinde kullanılmış.', 409);
            return existingRequest;
          }
        }
        const room = await tx.room.findUnique({ where: { id: roomId }, include: { block: true } });
        if (!room) throw new AppError('Seçilen oda bulunamadı.', 404);

        if (type === 'GENERAL') {
          const maintenance = await tx.maintenanceLog.create({
            data: {
              requestKey: requestKey || null,
              roomId,
              type,
              title: (title?.trim() || category?.trim() || cleanDescription.slice(0, 50) || 'Arıza Bildirimi').toLocaleUpperCase('tr-TR'),
              description: cleanDescription,
              priority,
              status: 'OPEN',
              reportedBy: (reportedBy?.trim() || 'Lojman Yönetimi').toLocaleUpperCase('tr-TR'),
              category: category?.trim().toLocaleUpperCase('tr-TR') || null,
              location: location?.trim().toLocaleUpperCase('tr-TR') || null,
              assignedTo: assignedTo?.trim().toLocaleUpperCase('tr-TR') || null,
              createdById: createdById || null,
              updatedById: createdById || null,
            },
          });
          await tx.maintenanceEvent.create({ data: {
            maintenanceId: maintenance.id, action: 'FAULT_REPORTED', toStatus: 'OPEN', notes: cleanDescription,
            performedBy: (reportedBy?.trim() || 'Lojman Yönetimi').toLocaleUpperCase('tr-TR'),
            performedById: createdById || null,
          } });
          await syncRoomStatusForMaintenance(tx, roomId);
          return tx.maintenanceLog.findUniqueOrThrow({ where: { id: maintenance.id }, include: maintenanceInclude });
        }

        const inventory = await tx.roomInventory.findUnique({
          where: { id: roomInventoryId! },
          include: { stockItem: true },
        });
        if (!inventory || inventory.roomId !== roomId || inventory.returnedAt) {
          throw new AppError('Seçilen aktif demirbaş bu odaya ait değil.', 409);
        }
        const activeFault = await tx.maintenanceLog.findFirst({
          where: { roomInventoryId: inventory.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true },
        });
        if (activeFault) throw new AppError('Bu demirbaş için devam eden bir arıza kaydı zaten bulunuyor.', 409);

        const maintenance = await tx.maintenanceLog.create({
          data: {
            requestKey: requestKey || null,
            roomId,
            type,
            roomInventoryId: inventory.id,
            inventoryStatus,
            inventoryItemNameSnapshot: inventory.itemName,
            inventoryBrandSnapshot: inventory.brand,
            inventorySerialNoSnapshot: inventory.serialNo,
            inventoryAssetTagSnapshot: inventory.assetTag,
            inventoryQuantitySnapshot: inventory.quantity,
            title: (title?.trim() || `Demirbaş Arızası - ${inventory.itemName}`).toLocaleUpperCase('tr-TR'),
            description: cleanDescription,
            priority,
            status: 'OPEN',
            reportedBy: (reportedBy?.trim() || 'Lojman Yönetimi').toLocaleUpperCase('tr-TR'),
            category: (category?.trim() || 'Demirbaş Arızası').toLocaleUpperCase('tr-TR'),
            location: (location?.trim() || `${inventory.itemName}${inventory.serialNo ? ` / ${inventory.serialNo}` : ''}`).toLocaleUpperCase('tr-TR'),
            assignedTo: assignedTo?.trim().toLocaleUpperCase('tr-TR') || null,
            createdById: createdById || null,
            updatedById: createdById || null,
          },
        });

        await tx.maintenanceEvent.create({ data: {
          maintenanceId: maintenance.id,
          action: 'FAULT_REPORTED',
          toStatus: 'OPEN',
          inventoryStatus,
          notes: cleanDescription,
          performedBy: (reportedBy?.trim() || 'Lojman Yönetimi').toLocaleUpperCase('tr-TR'),
          performedById: createdById || null,
        } });

        const isLost = inventoryStatus === 'LOST';
        const changed = await tx.roomInventory.updateMany({
          where: { id: inventory.id, roomId, returnedAt: null },
          data: {
            status: inventoryStatus,
            ...(isLost ? { returnedAt: new Date() } : {}),
          },
        });
        if (changed.count !== 1) throw new AppError('Demirbaş durumu başka bir işlemde değişti. Kayıt oluşturulmadı.', 409);

        if (isLost) {
          await releaseRoomStock(tx, inventory.stockItemId, inventory.quantity, true);
        }
        await tx.stockMovement.create({
          data: {
            stockItemId: inventory.stockItemId,
            roomId,
            roomInventoryId: inventory.id,
            maintenanceId: maintenance.id,
            type: isLost ? 'RETIREMENT' : 'STATUS_CHANGE',
            quantity: isLost ? -inventory.quantity : 0,
            itemNameSnapshot: inventory.itemName,
            roomLabelSnapshot: `${room.block.name} / ODA ${room.roomNumber}`,
            brand: inventory.brand,
            serialNo: inventory.serialNo,
            reason: isLost ? 'ARIZA KAYDI: KAYIP / ZAYİ' : `ARIZA KAYDI: ${inventoryStatus}`,
            notes: cleanDescription,
            createdById,
          },
        });

        await syncRoomStatusForMaintenance(tx, roomId);

        return tx.maintenanceLog.findUniqueOrThrow({ where: { id: maintenance.id }, include: maintenanceInclude });
      });
    } catch (error: any) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        if (requestKey) {
          const existingRequest = await prisma.maintenanceLog.findUnique({ where: { requestKey }, include: maintenanceInclude });
          const sameRequest = existingRequest
            && (existingRequest.createdById || null) === (createdById || null)
            && existingRequest.roomId === roomId
            && existingRequest.type === type
            && (existingRequest.roomInventoryId || null) === (roomInventoryId || null)
            && existingRequest.description === cleanDescription
            && existingRequest.priority === priority;
          if (sameRequest) return existingRequest;
        }
        throw new AppError('Bu demirbaş için devam eden bir arıza kaydı zaten bulunuyor.', 409);
      }
      if (error?.code === 'P2034') throw new AppError('Arıza veya oda aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    }
  },

  /**
   * Update an existing maintenance record
   */
  async updateMaintenance(id: string, data: UpdateMaintenanceInput) {
    const existing = await prisma.maintenanceLog.findUnique({ where: { id }, include: { roomInventory: true, room: { include: { block: true } } } });
    if (!existing) {
      throw new AppError('Arıza kaydı bulunamadı.', 404);
    }
    assertClosedMaintenanceEditable(existing.status, Boolean(data.canFullUpdate));
    if (data.status) assertMaintenanceTransition(existing.status, data.status, Boolean(data.canFullUpdate));
    if (data.inventoryStatus && existing.type !== 'ROOM_INVENTORY') throw new AppError('Genel oda arızasında demirbaş durumu değiştirilemez.', 400);
    if (data.inventoryStatus === 'LOST' || data.inventoryStatus === 'RETIRED') throw new AppError('Kayıp/hurda işlemleri mevcut arıza güncellemesinden yapılamaz; kontrollü stok süreci kullanılmalıdır.', 400);
    if (data.resolutionNote !== undefined && existing.resolutionNote?.trim() && !data.resolutionNote?.trim()) {
      throw new AppError('Kaydedilmiş çözüm notu silinemez; gerekiyorsa yeni ve açıklayıcı bir notla güncellenebilir.', 409);
    }
    const nextMaintenanceStatus = data.status || existing.status;
    if (existing.type === 'ROOM_INVENTORY' && data.inventoryStatus) {
      if (['OPEN', 'IN_PROGRESS'].includes(nextMaintenanceStatus) && !inventoryFaultStatuses.has(data.inventoryStatus)) {
        throw new AppError('Devam eden demirbaş arızasında cihaz durumu sağlam olarak işaretlenemez.', 400);
      }
      if (['RESOLVED', 'CLOSED'].includes(nextMaintenanceStatus) && data.inventoryStatus !== 'HEALTHY') {
        throw new AppError('Sonuçlanan demirbaş arızasında cihaz durumu Sağlam / Kullanımda olmalıdır. Hurda ve değişim için kontrollü stok sürecini kullanın.', 400);
      }
    }
    const sentAt = data.sentToServiceAt === undefined ? existing.sentToServiceAt : (data.sentToServiceAt ? new Date(data.sentToServiceAt) : null);
    const returnedAt = data.returnedFromServiceAt === undefined ? existing.returnedFromServiceAt : (data.returnedFromServiceAt ? new Date(data.returnedFromServiceAt) : null);
    if ((sentAt && isNaN(sentAt.getTime())) || (returnedAt && isNaN(returnedAt.getTime()))) throw new AppError('Servis tarihleri geçersiz.', 400);
    if (returnedAt && !sentAt) throw new AppError('Servisten dönüş tarihi girilmeden önce servise gönderilme tarihi kaydedilmelidir.', 400);
    if (sentAt && returnedAt && returnedAt < sentAt) throw new AppError('Servisten dönüş tarihi gönderilme tarihinden önce olamaz.', 400);
    if (['RESOLVED', 'CLOSED'].includes(nextMaintenanceStatus) && sentAt && !returnedAt) {
      throw new AppError('Servise gönderilmiş bir arıza, servisten dönüş tarihi kaydedilmeden sonuçlandırılamaz.', 400);
    }

    if (existing.type === 'ROOM_INVENTORY' && data.status && ['OPEN', 'IN_PROGRESS'].includes(data.status)) {
      const conflictingFault = await prisma.maintenanceLog.findFirst({
        where: { roomInventoryId: existing.roomInventoryId, id: { not: id }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        select: { id: true },
      });
      if (conflictingFault) throw new AppError('Bu demirbaş için başka bir aktif arıza kaydı bulunuyor. Eski kayıt yeniden açılamaz.', 409);
    }

    const updateData: Prisma.MaintenanceLogUncheckedUpdateInput = {};

    if (data.title?.trim()) updateData.title = data.title.trim().toLocaleUpperCase('tr-TR');
    if (data.description?.trim()) updateData.description = data.description.trim().toLocaleUpperCase('tr-TR');
    if (data.priority) updateData.priority = data.priority;
    if (data.category !== undefined) updateData.category = data.category?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.location !== undefined) updateData.location = data.location?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.resolutionNote !== undefined) updateData.resolutionNote = data.resolutionNote?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.serviceProvider !== undefined) updateData.serviceProvider = data.serviceProvider?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.serviceReference !== undefined) updateData.serviceReference = data.serviceReference?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.laborCost !== undefined) updateData.laborCost = Math.max(0, Number(data.laborCost) || 0);
    if (data.partsCost !== undefined) updateData.partsCost = Math.max(0, Number(data.partsCost) || 0);
    if (data.warrantyCovered !== undefined) updateData.warrantyCovered = Boolean(data.warrantyCovered);
    if (data.sentToServiceAt !== undefined) updateData.sentToServiceAt = data.sentToServiceAt ? new Date(data.sentToServiceAt) : null;
    if (data.returnedFromServiceAt !== undefined) updateData.returnedFromServiceAt = data.returnedFromServiceAt ? new Date(data.returnedFromServiceAt) : null;
    updateData.updatedById = data.performedById || null;

    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
        updateData.resolvedAt = new Date();
        if ((updateData.assignedTo === undefined || updateData.assignedTo === null) && !existing.assignedTo) {
          updateData.assignedTo = data.performedBy.trim().toLocaleUpperCase('tr-TR') || 'LOJMAN YÖNETİMİ';
        }
      } else {
        updateData.resolvedAt = null;
      }
    }

    try {
      return await executeTransactionWithRetry(async (tx) => {
      const changed = await tx.maintenanceLog.updateMany({ where: { id, updatedAt: existing.updatedAt }, data: updateData as Prisma.MaintenanceLogUpdateManyMutationInput });
      if (changed.count !== 1) throw new AppError('Arıza kaydı başka bir kullanıcı tarafından güncellendi. Güncel veriyi yenileyip tekrar deneyin.', 409);
      let nextInventoryStatus = data.inventoryStatus;
      if (existing.type === 'ROOM_INVENTORY' && existing.roomInventory && !existing.roomInventory.returnedAt) {
        if ((data.status === 'RESOLVED' || data.status === 'CLOSED') && !nextInventoryStatus) nextInventoryStatus = 'HEALTHY';
        if (data.status === 'OPEN' && (existing.status === 'RESOLVED' || existing.status === 'CLOSED') && !nextInventoryStatus) {
          const priorEvent = await tx.maintenanceEvent.findFirst({
            where: {
              maintenanceId: id,
              inventoryStatus: { not: null },
              toStatus: { in: ['OPEN', 'IN_PROGRESS'] },
            },
            orderBy: { createdAt: 'desc' },
            select: { inventoryStatus: true },
          });
          nextInventoryStatus = priorEvent?.inventoryStatus || (existing.inventoryStatus as RoomInventoryStatus) || 'MAINTENANCE_REQUIRED';
        }
        if (nextInventoryStatus && nextInventoryStatus !== existing.roomInventory.status) {
          const inventoryChanged = await tx.roomInventory.updateMany({
            where: { id: existing.roomInventory.id, returnedAt: null, updatedAt: existing.roomInventory.updatedAt },
            data: { status: nextInventoryStatus },
          });
          if (inventoryChanged.count !== 1) throw new AppError('Bağlı demirbaş aynı anda başka bir stok işleminde değiştirildi. Sayfayı yenileyip tekrar deneyin.', 409);
          await tx.stockMovement.create({ data: {
            stockItemId: existing.roomInventory.stockItemId,
            roomId: existing.roomId,
            roomInventoryId: existing.roomInventory.id,
            maintenanceId: existing.id,
            type: 'STATUS_CHANGE',
            quantity: 0,
            itemNameSnapshot: existing.roomInventory.itemName,
            roomLabelSnapshot: `${existing.room.block.name} / ODA ${existing.room.roomNumber}`,
            brand: existing.roomInventory.brand,
            serialNo: existing.roomInventory.serialNo,
            reason: `ARIZA SÜRECİ: ${nextInventoryStatus}`,
            notes: data.resolutionNote?.trim() || null,
            createdById: data.performedById || null,
          } });
        }
      }
      await tx.maintenanceEvent.create({ data: {
        maintenanceId: id,
        action: data.status && data.status !== existing.status ? 'STATUS_CHANGED' : 'DETAILS_UPDATED',
        fromStatus: existing.status,
        toStatus: data.status || existing.status,
        inventoryStatus: nextInventoryStatus,
        notes: data.resolutionNote?.trim().toLocaleUpperCase('tr-TR') || data.description?.trim().toLocaleUpperCase('tr-TR') || null,
        serviceProvider: data.serviceProvider?.trim().toLocaleUpperCase('tr-TR') || null,
        serviceReference: data.serviceReference?.trim().toLocaleUpperCase('tr-TR') || null,
        laborCost: data.laborCost,
        partsCost: data.partsCost,
        warrantyCovered: data.warrantyCovered,
        performedBy: data.performedBy.trim().toLocaleUpperCase('tr-TR'),
        performedById: data.performedById || null,
      } });
      await syncRoomStatusForMaintenance(tx, existing.roomId);
      return tx.maintenanceLog.findUniqueOrThrow({ where: { id }, include: maintenanceInclude });
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2002') throw new AppError('Bu demirbaş için başka bir aktif arıza kaydı bulunuyor.', 409);
      if (error?.code === 'P2034') throw new AppError('Arıza, oda veya demirbaş aynı anda değiştirildi. Lütfen işlemi yeniden deneyin.', 409);
      throw error;
    }
  },

  /**
   * Delete a maintenance record
   */
  async deleteMaintenance(id: string, _actorUserId?: string) {
    const existing = await prisma.maintenanceLog.findUnique({
      where: { id },
      include: { roomInventory: true, room: true },
    });
    if (!existing) {
      throw new AppError('Arıza kaydı bulunamadı.', 404);
    }

    try {
      return await executeTransactionWithRetry(async (tx) => {
        // 1. If linked to a RoomInventory, check if inventory status needs to revert to HEALTHY or restore LOST stock
        if (existing.type === 'ROOM_INVENTORY' && existing.roomInventoryId && existing.roomInventory) {
          const otherActiveFaults = await tx.maintenanceLog.findFirst({
            where: {
              roomInventoryId: existing.roomInventoryId,
              id: { not: id },
              status: { in: ['OPEN', 'IN_PROGRESS'] },
            },
            select: { id: true },
          });

          const isLostFault = existing.inventoryStatus === 'LOST' || existing.roomInventory.status === 'LOST';

          if (isLostFault && existing.roomInventory.returnedAt) {
            // Restore LOST stock: add back totalStock and usedInRooms, clear returnedAt, set HEALTHY
            await tx.stockItem.update({
              where: { id: existing.roomInventory.stockItemId },
              data: {
                totalStock: { increment: existing.roomInventory.quantity },
                usedInRooms: { increment: existing.roomInventory.quantity },
              },
            });
            await tx.roomInventory.update({
              where: { id: existing.roomInventoryId },
              data: { status: 'HEALTHY', returnedAt: null },
            });
          } else if (!otherActiveFaults && !existing.roomInventory.returnedAt && existing.roomInventory.status !== 'HEALTHY') {
            await tx.roomInventory.update({
              where: { id: existing.roomInventoryId },
              data: { status: 'HEALTHY' },
            });
          }
        }

        // 2. Delete linked maintenance events
        await tx.maintenanceEvent.deleteMany({ where: { maintenanceId: id } });

        // 3. Delete linked stock movements
        await tx.stockMovement.deleteMany({ where: { maintenanceId: id } });

        // 4. Delete the maintenance log
        await tx.maintenanceLog.delete({ where: { id } });

        // 5. Sync room status
        await syncRoomStatusForMaintenance(tx, existing.roomId);

        return { deleted: true };
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error?.code === 'P2034') throw new AppError('Arıza kaydı aynı anda başka bir işlem tarafından değiştirildi.', 409);
      throw error;
    }
  },
};
