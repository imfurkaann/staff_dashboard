import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { MaintenancePriority, MaintenanceStatus, Prisma } from '@prisma/client';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';

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
  title?: string;
  description: string;
  priority?: MaintenancePriority;
  category?: string;
  location?: string;
  reportedBy: string;
  assignedTo?: string;
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
        include: {
          room: {
            select: {
              id: true,
              roomNumber: true,
              floor: true,
              block: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
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
    const { roomId, title, description, priority = 'MEDIUM', category, location, reportedBy, assignedTo } = data;

    if (!roomId) throw new AppError('Arıza kaydı için oda seçilmelidir.', 400);
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppError('Seçilen oda bulunamadı.', 404);

    const maintenance = await prisma.maintenanceLog.create({
      data: {
        roomId,
        title: (title?.trim() || category?.trim() || description.trim().slice(0, 50) || 'Arıza Bildirimi').toLocaleUpperCase('tr-TR'),
        description: description.trim().toLocaleUpperCase('tr-TR'),
        priority,
        status: 'OPEN',
        reportedBy: (reportedBy?.trim() || 'Lojman Yönetimi').toLocaleUpperCase('tr-TR'),
        category: category?.trim().toLocaleUpperCase('tr-TR') || null,
        location: location?.trim().toLocaleUpperCase('tr-TR') || null,
        assignedTo: assignedTo?.trim().toLocaleUpperCase('tr-TR') || null,
      },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
            block: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return maintenance;
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
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            floor: true,
            block: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return updated;
  },

  /**
   * Delete a maintenance record
   */
  async deleteMaintenance(id: string) {
    const existing = await prisma.maintenanceLog.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Arıza kaydı bulunamadı.', 404);
    }

    await prisma.maintenanceLog.delete({ where: { id } });
    return { success: true };
  },
};
