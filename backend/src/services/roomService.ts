import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { MaintenancePriority, MaintenanceStatus, Prisma, RoomInventoryStatus, RoomStatus } from '@prisma/client';

const roomEmployeeSelect = {
  id: true,
  registrationNo: true,
  firstName: true,
  lastName: true,
  gender: true,
  department: true,
  title: true,
  company: true,
  isSmoker: true,
  hasSnoring: true,
  phone: true,
  photoUrl: true,
  status: true,
  shiftType: true,
  createdAt: true,
} satisfies Prisma.EmployeeSelect;

const roomListEmployeeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  gender: true,
  department: true,
  title: true,
  company: true,
  isSmoker: true,
  hasSnoring: true,
  status: true,
  shiftType: true,
  createdAt: true,
} satisfies Prisma.EmployeeSelect;

const maintenanceSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  location: true,
  priority: true,
  status: true,
  reportedBy: true,
  assignedTo: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  resolutionNote: true,
} satisfies Prisma.MaintenanceLogSelect;

export interface RoomFilterOptions {
  blockId?: string;
  floor?: number;
  status?: RoomStatus;
  search?: string;
}

export interface CreateRoomInput {
  blockId: string;
  floor: number;
  roomNumber: string;
  capacity?: number;
}

export interface CreateBlockInput {
  name: string;
  genderPolicy: string;
}

export const roomService = {
  /**
   * List all blocks with summary statistics (room count, bed capacity, occupied beds)
   */
  async getBlocks() {
    const blocks = await prisma.block.findMany({
      orderBy: { name: 'asc' },
      include: {
        rooms: {
          select: {
            id: true,
            capacity: true,
            status: true,
            beds: {
              select: {
                id: true,
                isOccupied: true,
              },
            },
          },
        },
      },
    });

    return blocks.map((block) => {
      const roomCount = block.rooms.length;
      let totalCapacity = 0;
      let occupiedBeds = 0;
      let outOfOrderRooms = 0;

      block.rooms.forEach((room) => {
        totalCapacity += room.capacity;
        if (room.status === 'OUT_OF_ORDER') outOfOrderRooms++;
        room.beds.forEach((bed) => {
          if (bed.isOccupied) occupiedBeds++;
        });
      });

      const vacantBeds = totalCapacity - occupiedBeds;
      const occupancyRate = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0;

      return {
        id: block.id,
        name: block.name,
        genderPolicy: block.genderPolicy,
        createdAt: block.createdAt,
        roomCount,
        totalCapacity,
        occupiedBeds,
        vacantBeds,
        outOfOrderRooms,
        occupancyRate,
      };
    });
  },

  /**
   * Get list of rooms matching filters
   */
  async getRooms(filters: RoomFilterOptions = {}) {
    const { blockId, floor, status, search } = filters;

    const whereCondition: Prisma.RoomWhereInput = {};

    if (blockId) {
      whereCondition.blockId = blockId;
    }

    if (floor !== undefined && !isNaN(floor)) {
      whereCondition.floor = floor;
    }

    if (status) {
      whereCondition.status = status;
    }

    if (search && search.trim() !== '') {
      const query = search.trim();
      whereCondition.OR = [
        { roomNumber: { contains: query, mode: 'insensitive' } },
        {
          beds: {
            some: {
              currentEmployee: {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { registrationNo: { contains: query, mode: 'insensitive' } },
                  { department: { contains: query, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    const rooms = await prisma.room.findMany({
      where: whereCondition,
      orderBy: [
        { block: { name: 'asc' } },
        { floor: 'asc' },
        { roomNumber: 'asc' },
      ],
      include: {
        block: {
          select: {
            id: true,
            name: true,
            genderPolicy: true,
          },
        },
        beds: {
          orderBy: { bedLabel: 'asc' },
          include: {
            currentEmployee: { select: roomListEmployeeSelect },
          },
        },
      },
    });

    return rooms;
  },

  /** Get a single room with detail-only relations. */
  async getRoomById(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        block: { select: { id: true, name: true, genderPolicy: true } },
        beds: {
          orderBy: { bedLabel: 'asc' },
          include: {
            currentEmployee: { select: roomEmployeeSelect },
            occupancies: {
              orderBy: { checkInDate: 'desc' },
              include: { employee: { select: roomEmployeeSelect } },
            },
          },
        },
        maintenances: { orderBy: { createdAt: 'desc' }, select: maintenanceSelect },
        inventories: { orderBy: [{ location: 'asc' }, { itemName: 'asc' }] },
      },
    });
    if (!room) throw new AppError('Oda bulunamadı.', 404);

    const occupancyHistory = room.beds.flatMap((bed) => bed.occupancies.map((occupancy) => ({
      id: occupancy.id,
      bedId: bed.id,
      bedLabel: bed.bedLabel,
      employee: occupancy.employee || {
        id: `deleted-${occupancy.id}`,
        registrationNo: null,
        firstName: occupancy.employeeName,
        lastName: '',
        gender: '',
        department: occupancy.employeeDepartment || '-',
        title: occupancy.employeeTitle,
        company: occupancy.employeeCompany,
        isSmoker: false,
        hasSnoring: false,
        phone: null,
        photoUrl: null,
        status: 'CHECKED_OUT' as const,
        shiftType: null,
        createdAt: occupancy.createdAt,
      },
      checkInDate: occupancy.checkInDate,
      checkOutDate: occupancy.checkOutDate,
      transferReason: occupancy.transferReason,
    }))).sort((a, b) => b.checkInDate.getTime() - a.checkInDate.getTime());

    return {
      ...room,
      beds: room.beds.map(({ occupancies, ...bed }) => ({
        ...bed,
        currentEmployee: bed.currentEmployee ? {
          ...bed.currentEmployee,
          checkInDate: occupancies.find((item) => item.employeeId === bed.currentEmployeeId && !item.checkOutDate)?.checkInDate || null,
        } : null,
      })),
      occupancyHistory,
    };
  },

  /**
   * Get high-level room & bed statistics
   */
  async getRoomStats() {
    const [totalRooms, readyRooms, cleaningRooms, outOfOrderRooms, totalBeds, occupiedBeds] = await Promise.all([
      prisma.room.count(),
      prisma.room.count({ where: { status: 'READY' } }),
      prisma.room.count({ where: { status: 'NEEDS_CLEANING' } }),
      prisma.room.count({ where: { status: 'OUT_OF_ORDER' } }),
      prisma.bed.count(),
      prisma.bed.count({ where: { isOccupied: true } }),
    ]);
    const vacantBeds = totalBeds - occupiedBeds;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      totalRooms,
      readyRooms,
      cleaningRooms,
      outOfOrderRooms,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
    };
  },

  /**
   * Update room status (READY, NEEDS_CLEANING, OUT_OF_ORDER)
   */
  async updateRoomStatus(roomId: string, status: RoomStatus) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new AppError('Oda bulunamadı.', 404);
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { status },
    });
    return this.getRoomById(roomId);
  },

  /**
   * Create a new room with auto-generated bed records
   */
  async createRoom(data: CreateRoomInput) {
    const { blockId, floor, roomNumber, capacity = 2 } = data;

    const block = await prisma.block.findUnique({ where: { id: blockId } });
    if (!block) {
      throw new AppError('Geçersiz blok seçimi.', 400);
    }

    const existing = await prisma.room.findFirst({
      where: { blockId, roomNumber },
    });
    if (existing) {
      throw new AppError(`${block.name} bloğunda '${roomNumber}' numaralı oda zaten mevcut.`, 400);
    }

    // Alphabetical labels: Yatak-A, Yatak-B, Yatak-C, Yatak-D ...
    const bedLabels = Array.from({ length: capacity }, (_, i) => `Yatak-${String.fromCharCode(65 + i)}`);

    const newRoom = await prisma.room.create({
      data: {
        blockId,
        floor: Number(floor),
        roomNumber,
        capacity: Number(capacity),
        status: 'READY',
        beds: {
          create: bedLabels.map((label) => ({
            bedLabel: label,
            isOccupied: false,
          })),
        },
        inventories: {
          create: [
            { itemName: 'Televizyon (Smart LED TV)', location: 'ODA ORTAK' },
            { itemName: 'Minibar (Buzdolabı)', location: 'ODA ORTAK' },
            { itemName: 'Klima (Inverter)', location: 'ODA ORTAK' },
            ...bedLabels.flatMap((label) => [
              { itemName: 'Yatak (Ortopedik)', location: label.toLocaleUpperCase('tr-TR') },
              { itemName: 'Baza (Sandıklı)', location: label.toLocaleUpperCase('tr-TR') },
            ]),
          ],
        },
      },
      include: {
        block: true,
        beds: true,
      },
    });

    return newRoom;
  },

  /**
   * Create a new block
   */
  async createBlock(data: CreateBlockInput) {
    const { name, genderPolicy } = data;
    const normalizedName = name.trim().toLocaleUpperCase('tr-TR');

    const existing = await prisma.block.findFirst({ where: { name: { equals: normalizedName, mode: 'insensitive' } } });
    if (existing) {
      throw new AppError(`'${name}' isimli blok zaten mevcut.`, 400);
    }

    const block = await prisma.block.create({
      data: {
        name: normalizedName,
        genderPolicy: genderPolicy || 'Mixed',
      },
    });

    return block;
  },

  /**
   * Create a new maintenance/fault record for a room
   */
  async createMaintenance(data: {
    roomId: string;
    title: string;
    description: string;
    priority: MaintenancePriority;
    reportedBy: string;
    category?: string;
    location?: string;
  }) {
    const { roomId, title, description, priority, reportedBy, category, location } = data;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new AppError('Oda bulunamadı.', 404);
    }

    const maintenance = await prisma.maintenanceLog.create({
      data: {
        roomId,
        title: title.trim(),
        description: description.trim().toLocaleUpperCase('tr-TR'),
        category: category?.trim() || null,
        location: location?.trim().toLocaleUpperCase('tr-TR') || null,
        priority,
        status: 'OPEN',
        reportedBy,
      },
    });

    return maintenance;
  },

  /**
   * Update an existing maintenance record
   */
  async updateMaintenance(maintenanceId: string, data: {
    title?: string;
    description?: string;
    priority?: MaintenancePriority;
    status?: MaintenanceStatus;
    assignedTo?: string | null;
    category?: string | null;
    location?: string | null;
    resolutionNote?: string | null;
  }) {
    const existing = await prisma.maintenanceLog.findUnique({ where: { id: maintenanceId } });
    if (!existing) {
      throw new AppError('Arıza kaydı bulunamadı.', 404);
    }

    const updateData: {
      title?: string;
      description?: string;
      priority?: MaintenancePriority;
      status?: MaintenanceStatus;
      assignedTo?: string | null;
      category?: string | null;
      location?: string | null;
      resolutionNote?: string | null;
      resolvedAt?: Date | null;
    } = {};
    if (data.title?.trim()) updateData.title = data.title.trim();
    if (data.description?.trim()) updateData.description = data.description.trim().toLocaleUpperCase('tr-TR');
    if (data.priority) updateData.priority = data.priority;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo?.trim() || null;
    if (data.category !== undefined) updateData.category = data.category?.trim() || null;
    if (data.location !== undefined) updateData.location = data.location?.trim().toLocaleUpperCase('tr-TR') || null;
    if (data.resolutionNote !== undefined) updateData.resolutionNote = data.resolutionNote?.trim() || null;
    if (data.status) {
      updateData.status = data.status;
      updateData.resolvedAt = data.status === 'RESOLVED' || data.status === 'CLOSED' ? new Date() : null;
    }

    const updated = await prisma.maintenanceLog.update({
      where: { id: maintenanceId },
      data: updateData,
    });

    return updated;
  },

  /**
   * Delete a maintenance record
   */
  async deleteMaintenance(maintenanceId: string) {
    const existing = await prisma.maintenanceLog.findUnique({ where: { id: maintenanceId } });
    if (!existing) {
      throw new AppError('Arıza kaydı bulunamadı.', 404);
    }

    await prisma.maintenanceLog.delete({ where: { id: maintenanceId } });
    return { deleted: true };
  },

  async updateInventory(inventoryId: string, data: { status?: RoomInventoryStatus; notes?: string | null }) {
    const existing = await prisma.roomInventory.findUnique({ where: { id: inventoryId } });
    if (!existing) throw new AppError('Oda zimmet kaydı bulunamadı.', 404);
    return prisma.roomInventory.update({
      where: { id: inventoryId },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes?.trim().toLocaleUpperCase('tr-TR') || null }),
      },
    });
  },
};
