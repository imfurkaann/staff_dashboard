import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { MaintenancePriority, MaintenanceStatus, Prisma } from '@prisma/client';

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
   * Get all maintenance records with filters and summary statistics
   */
  async getMaintenances(filters: MaintenanceFilterOptions = {}) {
    const { status, priority, category, blockId, search, dateStart, dateEnd } = filters;

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
      whereCondition.createdAt = {};
      if (dateStart) {
        whereCondition.createdAt.gte = new Date(`${dateStart}T00:00:00.000Z`);
      }
      if (dateEnd) {
        whereCondition.createdAt.lte = new Date(`${dateEnd}T23:59:59.999Z`);
      }
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

    const [items, totalCount, openCount, inProgressCount, resolvedCount, urgentCount] = await Promise.all([
      prisma.maintenanceLog.findMany({
        where: whereCondition,
        orderBy: [
          { status: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
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
      prisma.maintenanceLog.count({ where: { status: 'OPEN' } }),
      prisma.maintenanceLog.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.maintenanceLog.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.maintenanceLog.count({ where: { priority: { in: ['HIGH', 'URGENT'] }, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);

    return {
      items,
      summary: {
        totalCount,
        openCount,
        inProgressCount,
        resolvedCount,
        urgentCount,
      },
    };
  },

  /**
   * Create a new maintenance record
   */
  async createMaintenance(data: CreateMaintenanceInput) {
    const { roomId, title, description, priority = 'MEDIUM', category, location, reportedBy, assignedTo } = data;

    let targetRoomId = roomId;

    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new AppError('Seçilen oda bulunamadı.', 404);
      }
    } else {
      // If no roomId provided, attach to a default/first room or require room selection
      const firstRoom = await prisma.room.findFirst({ orderBy: { roomNumber: 'asc' } });
      if (firstRoom) {
        targetRoomId = firstRoom.id;
      } else {
        throw new AppError('Arıza kaydı için sistemde en az bir oda tanımlı olmalıdır.', 400);
      }
    }

    const maintenance = await prisma.maintenanceLog.create({
      data: {
        roomId: targetRoomId!,
        title: title?.trim() || category?.trim() || description.trim().slice(0, 50) || 'Arıza Bildirimi',
        description: description.trim().toLocaleUpperCase('tr-TR'),
        priority,
        status: 'OPEN',
        reportedBy: reportedBy?.trim() || 'Lojman Yönetimi',
        category: category?.trim() || null,
        location: location?.trim().toLocaleUpperCase('tr-TR') || null,
        assignedTo: assignedTo?.trim() || null,
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

    if (data.title?.trim()) updateData.title = data.title.trim();
    if (data.description?.trim()) updateData.description = data.description.trim().toLocaleUpperCase('tr-TR');
    if (data.priority) updateData.priority = data.priority;
    if (data.category !== undefined) updateData.category = data.category?.trim() || null;
    if (data.location !== undefined) updateData.location = data.location?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo?.trim() || null;
    if (data.resolutionNote !== undefined) updateData.resolutionNote = data.resolutionNote?.trim() || null;

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
