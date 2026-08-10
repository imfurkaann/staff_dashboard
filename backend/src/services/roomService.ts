import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { Prisma, RoomInventoryStatus, RoomStatus } from '@prisma/client';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { reserveRoomStock } from '../utils/stockBalance';

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
  inventories: {
    orderBy: { createdAt: 'desc' },
  },
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
  type: true,
  roomInventoryId: true,
  inventoryStatus: true,
  inventoryItemNameSnapshot: true,
  inventoryBrandSnapshot: true,
  inventorySerialNoSnapshot: true,
  inventoryQuantitySnapshot: true,
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
  roomType?: string;
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
        inventories: {
          where: { returnedAt: null, status: { notIn: ['LOST', 'RETIRED'] } },
          orderBy: [{ itemName: 'asc' }, { serialNo: 'asc' }],
        },
        cleaningLogs: { orderBy: { requestedAt: 'desc' } },
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
  async updateRoomStatus(roomId: string, status: RoomStatus, userFullName: string = 'Lojman Yönetimi') {
    if (!Object.values(RoomStatus).includes(status)) throw new AppError('Geçersiz oda durumu.', 400);
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new AppError('Oda bulunamadı.', 404);
    }

    if (room.status !== status) {
      if (status === 'NEEDS_CLEANING') {
        // Open a new cleaning log when status becomes NEEDS_CLEANING
        await prisma.roomCleaningLog.create({
          data: {
            roomId,
            status: 'NEEDS_CLEANING',
            requestedBy: userFullName.toLocaleUpperCase('tr-TR'),
            notes: 'ODA DURUMU TEMİZLİK BEKLİYOR OLARAK GÜNCELLENDİ.',
            requestedAt: new Date(),
          },
        });
      } else if (status === 'READY') {
        // Close active cleaning logs when status becomes READY
        const activeLogs = await prisma.roomCleaningLog.findMany({
          where: { roomId, status: { not: 'CLEANED' } },
        });

        if (activeLogs.length > 0) {
          await prisma.roomCleaningLog.updateMany({
            where: { roomId, status: { not: 'CLEANED' } },
            data: {
              status: 'CLEANED',
              cleanedAt: new Date(),
              cleanedBy: userFullName.toLocaleUpperCase('tr-TR'),
            },
          });
        } else {
          // If no active cleaning log, log a completed record
          await prisma.roomCleaningLog.create({
            data: {
              roomId,
              status: 'CLEANED',
              requestedBy: userFullName.toLocaleUpperCase('tr-TR'),
              cleanedBy: userFullName.toLocaleUpperCase('tr-TR'),
              notes: 'ODA DURUMU HAZIR OLARAK GÜNCELLENDİ.',
              requestedAt: new Date(),
              cleanedAt: new Date(),
            },
          });
        }
      }
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { status },
    });
    return this.getRoomById(roomId);
  },

  /** Create a new room cleaning log */
  async createCleaningLog(roomId: string, data: { requestedBy?: string; cleanedBy?: string; notes?: string; status?: string }) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppError('Oda bulunamadı.', 404);

    const logStatus = data.status || 'NEEDS_CLEANING';
    if (!['NEEDS_CLEANING', 'IN_PROGRESS', 'CLEANED'].includes(logStatus)) {
      throw new AppError('Geçersiz temizlik durumu.', 400);
    }
    const isCleaned = logStatus === 'CLEANED';
    if (!isCleaned) {
      const activeLog = await prisma.roomCleaningLog.findFirst({ where: { roomId, status: { not: 'CLEANED' } }, select: { id: true } });
      if (activeLog) throw new AppError('Bu oda için zaten açık bir temizlik kaydı bulunuyor.', 409);
    }

    await prisma.roomCleaningLog.create({
      data: {
        roomId,
        status: logStatus,
        requestedBy: (data.requestedBy || 'Lojman Yönetimi').toLocaleUpperCase('tr-TR'),
        cleanedBy: (data.cleanedBy || (isCleaned ? 'Lojman Yönetimi' : null))?.toLocaleUpperCase('tr-TR') || null,
        notes: data.notes?.trim().toLocaleUpperCase('tr-TR') || null,
        requestedAt: new Date(),
        cleanedAt: isCleaned ? new Date() : null,
      },
    });

    if (logStatus === 'NEEDS_CLEANING' && room.status !== 'NEEDS_CLEANING') {
      await prisma.room.update({ where: { id: roomId }, data: { status: 'NEEDS_CLEANING' } });
    } else if (isCleaned && room.status === 'NEEDS_CLEANING') {
      await prisma.room.update({ where: { id: roomId }, data: { status: 'READY' } });
    }

    return this.getRoomById(roomId);
  },

  /** Update an existing room cleaning log */
  async updateCleaningLog(logId: string, data: { status?: string; cleanedBy?: string | null; notes?: string; requestedBy?: string }) {
    const existing = await prisma.roomCleaningLog.findUnique({ where: { id: logId } });
    if (!existing) throw new AppError('Temizlik kaydı bulunamadı.', 404);
    if (data.status !== undefined && !['NEEDS_CLEANING', 'IN_PROGRESS', 'CLEANED'].includes(data.status)) {
      throw new AppError('Geçersiz temizlik durumu.', 400);
    }

    const isCleaned = data.status === 'CLEANED';
    const cleanedAt = isCleaned && !existing.cleanedAt ? new Date() : (data.status && !isCleaned ? null : existing.cleanedAt);

    await prisma.roomCleaningLog.update({
      where: { id: logId },
      data: {
        status: data.status !== undefined ? data.status : existing.status,
        requestedBy: data.requestedBy !== undefined ? data.requestedBy.toLocaleUpperCase('tr-TR') : existing.requestedBy,
        cleanedBy: data.cleanedBy !== undefined ? data.cleanedBy?.toLocaleUpperCase('tr-TR') || null : (data.status && !isCleaned ? null : existing.cleanedBy),
        notes: data.notes !== undefined ? data.notes.toLocaleUpperCase('tr-TR') : existing.notes,
        cleanedAt,
      },
    });

    if (isCleaned) {
      const openCount = await prisma.roomCleaningLog.count({
        where: { roomId: existing.roomId, status: { not: 'CLEANED' } },
      });
      if (openCount === 0) {
        await prisma.room.update({ where: { id: existing.roomId }, data: { status: 'READY' } });
      }
    } else if (data.status === 'NEEDS_CLEANING') {
      await prisma.room.update({ where: { id: existing.roomId }, data: { status: 'NEEDS_CLEANING' } });
    }

    return this.getRoomById(existing.roomId);
  },

  /** Delete a room cleaning log */
  async deleteCleaningLog(logId: string) {
    const existing = await prisma.roomCleaningLog.findUnique({ where: { id: logId } });
    if (!existing) throw new AppError('Temizlik kaydı bulunamadı.', 404);

    await prisma.roomCleaningLog.delete({ where: { id: logId } });
    return this.getRoomById(existing.roomId);
  },

  /**
   * Create a new room with auto-generated bed records
   */
  async createRoom(data: CreateRoomInput) {
    const { blockId, floor, roomNumber, capacity = 2, roomType = 'PERSONEL_ODASI' } = data;
    const normalizedRoomNumber = typeof roomNumber === 'string' ? roomNumber.trim().toLocaleUpperCase('tr-TR') : '';
    const parsedFloor = Number(floor);
    const normalizedRoomType = typeof roomType === 'string' && roomType.trim() ? roomType.trim().toLocaleUpperCase('tr-TR') : 'PERSONEL_ODASI';
    const parsedCapacity = normalizedRoomType === 'PERSONEL_ODASI' ? Number(capacity) : 0;
    if (!normalizedRoomNumber || normalizedRoomNumber.length > 50) throw new AppError('Oda numarası veya oda adı zorunludur ve en fazla 50 karakter olabilir.', 400);
    if (!Number.isInteger(parsedFloor) || parsedFloor < -5 || parsedFloor > 200) throw new AppError('Kat değeri -5 ile 200 arasında tam sayı olmalıdır.', 400);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0 || parsedCapacity > 26) throw new AppError('Oda kapasitesi 0 ile 26 arasında olmalıdır.', 400);
    if (normalizedRoomType === 'PERSONEL_ODASI' && parsedCapacity < 1) throw new AppError('Konaklama odaları için en az 1 yatak kapasitesi girilmelidir.', 400);

    const block = await prisma.block.findUnique({ where: { id: blockId } });
    if (!block) {
      throw new AppError('Geçersiz blok seçimi.', 400);
    }

    const existing = await prisma.room.findFirst({
      where: { blockId, roomNumber: normalizedRoomNumber },
    });
    if (existing) {
      throw new AppError(`${block.name} bloğunda '${roomNumber}' numaralı oda zaten mevcut.`, 400);
    }

    // Alphabetical labels: Yatak-A, Yatak-B, Yatak-C, Yatak-D ...
    const bedLabels = Array.from({ length: parsedCapacity }, (_, i) => `YATAK-${String.fromCharCode(65 + i)}`);

    const newRoom = await prisma.room.create({
      data: {
        blockId,
        floor: parsedFloor,
        roomNumber: normalizedRoomNumber,
        capacity: parsedCapacity,
        roomType: normalizedRoomType,
        status: 'READY',
        beds: {
          create: bedLabels.map((label) => ({
            bedLabel: label,
            isOccupied: false,
          })),
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
    const normalizedName = typeof name === 'string' ? name.trim().toLocaleUpperCase('tr-TR') : '';
    if (!normalizedName || normalizedName.length > 50) throw new AppError('Blok adı zorunludur ve en fazla 50 karakter olabilir.', 400);
    if (!['Male', 'Female', 'Mixed'].includes(genderPolicy)) throw new AppError('Geçersiz yerleşim politikası.', 400);

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

  /** Update existing room details (roomNumber, floor, capacity, status) */
  async updateRoom(roomId: string, data: { roomNumber?: string; floor?: number; capacity?: number; roomType?: string; status?: RoomStatus }) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { beds: { orderBy: { bedLabel: 'asc' }, include: { _count: { select: { occupancies: true } } } }, block: true },
    });
    if (!room) throw new AppError('Oda bulunamadı.', 404);

    const updateData: any = {};

    if (data.roomType !== undefined) {
      updateData.roomType = data.roomType || 'PERSONEL_ODASI';
    }

    if (data.roomNumber !== undefined) {
      if (!data.roomNumber.trim()) throw new AppError('Oda numarası boş bırakılamaz.', 400);
      const normalizedRoomNumber = data.roomNumber.trim().toLocaleUpperCase('tr-TR');
      if (normalizedRoomNumber !== room.roomNumber) {
        const duplicate = await prisma.room.findFirst({
          where: { blockId: room.blockId, roomNumber: normalizedRoomNumber, NOT: { id: roomId } },
        });
        if (duplicate) {
          throw new AppError(`${room.block.name} bloğunda '${normalizedRoomNumber}' numaralı oda zaten mevcut.`, 400);
        }
        updateData.roomNumber = normalizedRoomNumber;
      }
    }

    if (data.floor !== undefined) {
      const floor = Number(data.floor);
      if (!Number.isInteger(floor) || floor < -5 || floor > 200) throw new AppError('Kat değeri -5 ile 200 arasında tam sayı olmalıdır.', 400);
      updateData.floor = floor;
    }

    if (data.status !== undefined) {
      if (!Object.values(RoomStatus).includes(data.status)) throw new AppError('Geçersiz oda durumu.', 400);
      updateData.status = data.status;
    }

    if (data.capacity !== undefined && Number(data.capacity) !== room.capacity) {
      const newCapacity = Number(data.capacity);
      if (!Number.isInteger(newCapacity) || newCapacity < 0 || newCapacity > 26) {
        throw new AppError('Oda kapasitesi 0 ile 26 arasında olmalıdır.', 400);
      }

      const currentBeds = room.beds;
      if (newCapacity > room.capacity) {
        const newBedCount = newCapacity - room.capacity;
        const newBedLabels = Array.from({ length: newBedCount }, (_, i) => `YATAK-${String.fromCharCode(65 + room.capacity + i)}`);

        await prisma.$transaction([
          prisma.bed.createMany({
            data: newBedLabels.map((label) => ({
              roomId,
              bedLabel: label,
              isOccupied: false,
            })),
          }),
          prisma.room.update({ where: { id: roomId }, data: { capacity: newCapacity } }),
        ]);
      } else if (newCapacity < room.capacity) {
        const bedsToRemove = currentBeds.slice(newCapacity);
        const occupiedBedsToRemove = bedsToRemove.filter((b) => b.isOccupied);
        if (occupiedBedsToRemove.length > 0) {
          throw new AppError(
            `Kapasite düşürülemez. Kaldırılacak yataklarda (${occupiedBedsToRemove.map((b) => b.bedLabel).join(', ')}) halen ikamet eden personel bulunmaktadır. Önce personelleri başka yatağa transfer edin.`,
            400
          );
        }
        const historicalBeds = bedsToRemove.filter((b) => b._count.occupancies > 0);
        if (historicalBeds.length > 0) {
          throw new AppError(`Kapasite düşürülemez. ${historicalBeds.map((b) => b.bedLabel).join(', ')} yataklarında geçmiş konaklama kaydı bulunmaktadır. Denetim geçmişini korumak için odayı arşivleyin.`, 409);
        }

        const bedIdsToRemove = bedsToRemove.map((b) => b.id);

        await prisma.$transaction([
          prisma.bed.deleteMany({ where: { id: { in: bedIdsToRemove } } }),
          prisma.room.update({ where: { id: roomId }, data: { capacity: newCapacity } }),
        ]);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.room.update({
        where: { id: roomId },
        data: updateData,
      });
    }

    return this.getRoomById(roomId);
  },

  /** Delete a room safely */
  async deleteRoom(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        beds: { select: { id: true, bedLabel: true, isOccupied: true, _count: { select: { occupancies: true } } } },
        block: { select: { name: true } },
        inventories: { select: { id: true, returnedAt: true } },
        _count: { select: { maintenances: true, cleaningLogs: true } },
      },
    });
    if (!room) throw new AppError('Oda bulunamadı.', 404);

    if (room.inventories.length > 0) {
      throw new AppError('Bu oda zimmet geçmişi içerdiği için silinemez. Odayı kullanım dışı durumuna alın.', 409);
    }
    if (room._count.maintenances > 0 || room._count.cleaningLogs > 0) {
      throw new AppError('Bu oda arıza veya temizlik geçmişi içerdiği için silinemez. Denetim geçmişini korumak için kullanım dışı durumuna alın.', 409);
    }

    const occupiedBeds = room.beds.filter((b) => b.isOccupied);
    if (occupiedBeds.length > 0) {
      throw new AppError(
        `'${room.block.name} - Oda ${room.roomNumber}' silinemez. Odadaki yataklarda (${occupiedBeds.map((b) => b.bedLabel).join(', ')}) halen ikamet eden personel bulunmaktadır.`,
        400
      );
    }
    const occupancyHistoryCount = room.beds.reduce((sum, bed) => sum + bed._count.occupancies, 0);
    if (occupancyHistoryCount > 0) {
      throw new AppError(`Bu oda ${occupancyHistoryCount} geçmiş konaklama kaydı içerdiği için silinemez. Denetim geçmişini korumak için odayı kullanım dışı durumuna alın.`, 409);
    }

    await prisma.room.delete({ where: { id: roomId } });
    return { success: true, message: `'${room.block.name} - Oda ${room.roomNumber}' başarıyla silindi.` };
  },

  /** Add custom fixture / inventory item to a room */
  async createRoomInventory(roomId: string, data: { itemName: string; brand?: string; serialNo?: string; quantity?: number; status?: RoomInventoryStatus; stockItemId: string; createdById?: string }) {
    const room = await prisma.room.findUnique({ where: { id: roomId }, include: { block: true } });
    if (!room) throw new AppError('Oda bulunamadı.', 404);

    const cleanBrand = data.brand?.trim() ? data.brand.trim().toLocaleUpperCase('tr-TR') : null;
    const cleanSerialNo = data.serialNo?.trim() ? data.serialNo.trim().toLocaleUpperCase('tr-TR') : null;
    const quantity = Number(data.quantity || 1);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError('Zimmet miktarı sıfırdan büyük tam sayı olmalıdır.', 400);

    return prisma.$transaction(async (tx) => {
      if (!data.stockItemId) throw new AppError('Oda zimmeti için depo stok kartı seçilmelidir.', 400);
      const stockItem = await tx.stockItem.findUnique({ where: { id: data.stockItemId } });
      if (!stockItem || !stockItem.isActive) throw new AppError('Seçilen aktif stok kartı depoda bulunamadı.', 404);
      if (stockItem.itemType !== 'SARF_MALZEME' && quantity > 1) throw new AppError('Demirbaşlar fiziksel cihaz takibi için tek tek ve 1 adet olarak zimmetlenmelidir.', 400);
      if (stockItem.itemType !== 'SARF_MALZEME' && !cleanSerialNo) throw new AppError('Demirbaş zimmeti için cihazın üretici seri numarası zorunludur.', 400);
      if (cleanSerialNo) {
        const duplicateSerial = await tx.roomInventory.findFirst({ where: { serialNo: cleanSerialNo, returnedAt: null } });
        if (duplicateSerial) throw new AppError('Bu seri numarası halen başka bir aktif demirbaşta kullanılıyor.', 409);
      }
      const cleanItemName = stockItem.itemName;
      const available = stockItem.totalStock - (stockItem.usedStock + stockItem.usedInRooms);
      if (available < quantity) throw new AppError(`Depoda yeterli stok yok. Müsait: ${available} ${stockItem.unit}. İstenen: ${quantity} ${stockItem.unit}.`, 400);

      await reserveRoomStock(tx, data.stockItemId, quantity);

      const existing = await tx.roomInventory.findFirst({
        where: { roomId, itemName: cleanItemName, serialNo: cleanSerialNo, returnedAt: null },
      });

      if (existing) {
        const updated = await tx.roomInventory.update({
          where: { id: existing.id },
          data: {
            quantity: existing.quantity + quantity,
            status: data.status || existing.status,
            brand: cleanBrand || existing.brand,
            stockItemId: data.stockItemId || existing.stockItemId,
          },
        });
        await tx.stockMovement.create({ data: { stockItemId: stockItem.id, roomId, roomInventoryId: updated.id, type: 'ROOM_ASSIGNMENT', quantity: -quantity, itemNameSnapshot: stockItem.itemName, roomLabelSnapshot: `${room.block.name} / ODA ${room.roomNumber}`, brand: updated.brand, serialNo: updated.serialNo, reason: 'ODA DETAYINDAN ZİMMET', createdById: data.createdById } });
        return updated;
      }

      let created = await tx.roomInventory.create({
        data: {
          roomId,
          itemName: cleanItemName,
          brand: cleanBrand,
          serialNo: cleanSerialNo,
          quantity,
          status: data.status || 'HEALTHY',
          stockItemId: data.stockItemId,
        },
      });
      created = await tx.roomInventory.update({ where: { id: created.id }, data: { assetTag: `${stockItem.itemCode || 'ENV'}-${created.id.replace(/-/g, '').slice(0, 10).toUpperCase()}` } });
      await tx.stockMovement.create({ data: { stockItemId: stockItem.id, roomId, roomInventoryId: created.id, type: 'ROOM_ASSIGNMENT', quantity: -quantity, itemNameSnapshot: stockItem.itemName, roomLabelSnapshot: `${room.block.name} / ODA ${room.roomNumber}`, brand: created.brand, serialNo: created.serialNo, reason: 'ODA DETAYINDAN ZİMMET', createdById: data.createdById } });
      return created;
    });
  },

  /**
   * Fetch room occupancies for Excel export
   */
  async getExportOccupancies(filter?: string, startDate?: string, endDate?: string) {
    const where: any = {};
    if (filter === 'ACTIVE') {
      where.checkOutDate = null;
    } else if (filter === 'CHECKED_OUT') {
      where.checkOutDate = { not: null };
    }

    if (startDate || endDate) {
      where.AND = where.AND || [];

      if (startDate && endDate) {
        const start = parseIstanbulDateBoundary(startDate, false)!;
        const end = parseIstanbulDateBoundary(endDate, true)!;
        assertDateRange(start, end);
        where.AND.push({
          checkInDate: { lte: end },
          OR: [
            { checkOutDate: null },
            { checkOutDate: { gte: start } },
          ],
        });
      } else if (startDate) {
        const start = parseIstanbulDateBoundary(startDate, false)!;
        where.AND.push({
          OR: [
            { checkOutDate: null },
            { checkOutDate: { gte: start } },
          ],
        });
      } else if (endDate) {
        const end = parseIstanbulDateBoundary(endDate, true)!;
        where.AND.push({
          checkInDate: { lte: end },
        });
      }
    }

    return prisma.occupancyLog.findMany({
      where,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            tcNo: true,
            registrationNo: true,
            department: true,
            title: true,
            company: true,
          },
        },
        createdBy: {
          select: {
            fullName: true,
            username: true,
          },
        },
        checkedOutBy: {
          select: {
            fullName: true,
            username: true,
          },
        },
        bed: {
          include: {
            room: {
              include: {
                block: true,
              },
            },
          },
        },
      },
      orderBy: { checkInDate: 'desc' },
    });
  },

  /**
   * Fetch room inventories / fixtures for Excel export
   */
  async getExportRoomInventories(statusFilter?: string) {
    const where: any = {};

    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'PROBLEMATIC_ALL') {
        where.status = { not: 'HEALTHY' };
      } else if (statusFilter === 'NEEDS_ATTENTION') {
        where.status = { in: ['MAINTENANCE_REQUIRED', 'REPLACEMENT_REQUIRED', 'IN_SERVICE'] };
      } else if (statusFilter === 'DAMAGED_LOST') {
        where.status = { in: ['DAMAGED', 'LOST', 'RETIRED'] };
      } else {
        where.status = statusFilter;
      }
    }

    return prisma.roomInventory.findMany({
      where,
      include: {
        room: {
          include: {
            block: true,
          },
        },
      },
      orderBy: [
        { room: { block: { name: 'asc' } } },
        { room: { roomNumber: 'asc' } },
        { itemName: 'asc' },
      ],
    });
  },
};
