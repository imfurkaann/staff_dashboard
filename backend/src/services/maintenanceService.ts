import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { MaintenancePriority, MaintenanceStatus, MaintenanceType, Prisma, RoomInventoryStatus } from '@prisma/client';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { releaseRoomStock } from '../utils/stockBalance';

const inventoryFaultStatuses = new Set<RoomInventoryStatus>([
  'MAINTENANCE_REQUIRED',
  'DAMAGED',
  'LOST',
  'IN_SERVICE',
  'REPLACEMENT_REQUIRED',
]);

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
    select: { id: true, status: true, returnedAt: true },
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
}

export interface CreateMaintenanceInput {
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
}

export const maintenanceService = {
  /**
   * Get maintenance records with filters, summary statistics, and pagination support
   */
  async getMaintenances(filters: MaintenanceFilterOptions = {}) {
    const { status, priority, category, blockId, search, dateStart, dateEnd, page, pageSize } = filters;

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
    const limit = pageSize && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : undefined;
    const skip = limit ? (currentPage - 1) * limit : undefined;

    const [items, totalCount, openCount, inProgressCount, resolvedCount, urgentCount] = await Promise.all([
      prisma.maintenanceLog.findMany({
        where: whereCondition,
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        ...(skip !== undefined ? { skip } : {}),
        ...(limit !== undefined ? { take: limit } : {}),
        include: maintenanceInclude,
      }),
      prisma.maintenanceLog.count({ where: whereCondition }),
      prisma.maintenanceLog.count({ where: { ...baseScopedCondition, status: 'OPEN' } }),
      prisma.maintenanceLog.count({ where: { ...baseScopedCondition, status: 'IN_PROGRESS' } }),
      prisma.maintenanceLog.count({ where: { ...baseScopedCondition, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.maintenanceLog.count({
        where: {
          ...baseScopedConditionForPriority,
          priority: { in: ['HIGH', 'URGENT'] },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
    ]);

    const effectiveLimit = limit || totalCount || 1;
    const totalPages = Math.ceil(totalCount / effectiveLimit) || 1;

    return {
      items,
      summary: {
        totalCount,
        openCount,
        inProgressCount,
        resolvedCount,
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
      return await prisma.$transaction(async (tx) => {
        const room = await tx.room.findUnique({ where: { id: roomId }, include: { block: true } });
        if (!room) throw new AppError('Seçilen oda bulunamadı.', 404);

        if (type === 'GENERAL') {
          return tx.maintenanceLog.create({
            data: {
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
            },
            include: maintenanceInclude,
          });
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
            roomId,
            type,
            roomInventoryId: inventory.id,
            inventoryStatus,
            inventoryItemNameSnapshot: inventory.itemName,
            inventoryBrandSnapshot: inventory.brand,
            inventorySerialNoSnapshot: inventory.serialNo,
            inventoryQuantitySnapshot: inventory.quantity,
            title: (title?.trim() || `Demirbaş Arızası - ${inventory.itemName}`).toLocaleUpperCase('tr-TR'),
            description: cleanDescription,
            priority,
            status: 'OPEN',
            reportedBy: (reportedBy?.trim() || 'Lojman Yönetimi').toLocaleUpperCase('tr-TR'),
            category: (category?.trim() || 'Demirbaş Arızası').toLocaleUpperCase('tr-TR'),
            location: (location?.trim() || `${inventory.itemName}${inventory.serialNo ? ` / ${inventory.serialNo}` : ''}`).toLocaleUpperCase('tr-TR'),
            assignedTo: assignedTo?.trim().toLocaleUpperCase('tr-TR') || null,
          },
        });

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

        return tx.maintenanceLog.findUniqueOrThrow({ where: { id: maintenance.id }, include: maintenanceInclude });
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new AppError('Bu demirbaş için devam eden bir arıza kaydı zaten bulunuyor.', 409);
      }
      throw error;
    }
  },

  /**
   * Update an existing maintenance record
   */
  async updateMaintenance(id: string, data: UpdateMaintenanceInput) {
    const existing = await prisma.maintenanceLog.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Arıza kaydı bulunamadı.', 404);
    }

    const updateData: Prisma.MaintenanceLogUpdateInput = {};

    if (data.title?.trim()) updateData.title = data.title.trim().toLocaleUpperCase('tr-TR');
    if (data.description?.trim()) updateData.description = data.description.trim().toLocaleUpperCase('tr-TR');
    if (data.priority) updateData.priority = data.priority;
    if (data.category !== undefined) updateData.category = data.category?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.location !== undefined) updateData.location = data.location?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.resolutionNote !== undefined) updateData.resolutionNote = data.resolutionNote?.trim().toLocaleUpperCase('tr-TR') || null;

    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
        updateData.resolvedAt = new Date();
        if (updateData.assignedTo === undefined && !existing.assignedTo) {
          updateData.assignedTo = 'Lojman Yönetimi';
        }
      } else {
        updateData.resolvedAt = null;
      }
    }

    const updated = await prisma.maintenanceLog.update({
      where: { id },
      data: updateData,
      include: maintenanceInclude,
    });

    return updated;
  },

  /**
   * Delete a maintenance record
   */
  async deleteMaintenance(id: string) {
    const existing = await prisma.maintenanceLog.findUnique({ where: { id }, include: { stockMovements: { select: { id: true }, take: 1 } } });
    if (!existing) {
      throw new AppError('Arıza kaydı bulunamadı.', 404);
    }

    if (existing.type === 'ROOM_INVENTORY' || existing.stockMovements.length > 0) {
      throw new AppError('Demirbaş ve stok hareketine bağlı arıza kayıtları denetim geçmişi için silinemez; kayıt kapatılabilir.', 409);
    }
    await prisma.maintenanceLog.delete({ where: { id } });
    return { success: true };
  },
};
