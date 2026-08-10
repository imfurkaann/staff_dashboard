import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { SharedAssetStatus } from '@prisma/client';

export class SharedAssetService {
  private static categoryPrefixes: Record<string, string> = {
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
  };

  private static async generateNextAssetCode(category?: string): Promise<string> {
    const prefix = (category && this.categoryPrefixes[category.toUpperCase()]) || 'ORT';
    const latestItems = await prisma.sharedAsset.findMany({
      where: { assetCode: { startsWith: `${prefix}-` } },
      select: { assetCode: true },
    });

    let maxIndex = 0;
    for (const item of latestItems) {
      const match = item.assetCode.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxIndex) maxIndex = num;
      }
    }

    const nextNumber = (maxIndex + 1).toString().padStart(3, '0');
    return `${prefix}-${nextNumber}`;
  }

  public static async getOverview() {
    const [assets, employees, rooms, logs] = await Promise.all([
      prisma.sharedAsset.findMany({
        include: {
          currentEmployee: { select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true } },
          currentRoom: { select: { id: true, roomNumber: true, floor: true, block: { select: { name: true } } } },
          logs: {
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: { createdBy: { select: { id: true, fullName: true } } },
          },
        },
        orderBy: [{ status: 'asc' }, { assetName: 'asc' }],
      }),
      prisma.employee.findMany({
        where: { isDeleted: false },
        select: { id: true, firstName: true, lastName: true, registrationNo: true, department: true },
        orderBy: { firstName: 'asc' },
      }),
      prisma.room.findMany({
        include: { block: true },
        orderBy: [{ block: { name: 'asc' } }, { roomNumber: 'asc' }],
      }),
      prisma.sharedAssetLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          asset: true,
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    const summary = {
      totalRegistered: assets.length,
      available: assets.filter((a) => a.status === 'AVAILABLE').length,
      loaned: assets.filter((a) => a.status === 'LOANED').length,
      maintenance: assets.filter((a) => a.status === 'MAINTENANCE').length,
      retired: assets.filter((a) => a.status === 'RETIRED').length,
    };

    return { assets, employees, rooms, logs, summary };
  }

  public static async createAsset(data: {
    assetName: string;
    assetCode?: string;
    category?: string;
    brandModel?: string;
    serialNo?: string;
    warrantyEndDate?: string;
    locationNote?: string;
    notes?: string;
  }) {
    const assetName = data.assetName?.trim();
    if (!assetName) throw new AppError('Ekipman/Eşya adı zorunludur.', 400);

    const category = data.category?.trim().toUpperCase() || 'GENEL EŞYALAR';
    let assetCode = data.assetCode?.trim().toUpperCase();
    if (!assetCode) {
      assetCode = await this.generateNextAssetCode(category);
    }

    const existing = await prisma.sharedAsset.findFirst({ where: { OR: [{ assetCode }, { assetName }] } });
    if (existing) {
      if (existing.assetCode === assetCode) throw new AppError('Bu koda sahip ortak eşya zaten kayıtlı.', 409);
    }

    return prisma.sharedAsset.create({
      data: {
        assetCode,
        assetName,
        category,
        brandModel: data.brandModel?.trim() || null,
        serialNo: data.serialNo?.trim() || null,
        warrantyEndDate: data.warrantyEndDate ? new Date(data.warrantyEndDate) : null,
        locationNote: data.locationNote?.trim() || 'Ana Depo',
        notes: data.notes?.trim() || null,
        status: 'AVAILABLE',
      },
      include: {
        currentEmployee: true,
        currentRoom: { include: { block: true } },
        logs: true,
      },
    });
  }

  public static async checkOutAsset(
    assetId: string,
    data: {
      holderType?: 'EMPLOYEE' | 'ROOM';
      employeeId?: string;
      customBorrowerName?: string;
      roomId?: string;
      expectedReturnDate?: string;
      notes?: string;
      createdById?: string;
    }
  ) {
    const asset = await prisma.sharedAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);
    if (asset.status === 'LOANED') throw new AppError('Bu eşya/makine zaten başka bir kullanıcıda zimmetli.', 409);
    if (asset.status === 'MAINTENANCE') throw new AppError('Bakımda olan eşya ödünç verilemez.', 409);
    if (asset.status === 'RETIRED') throw new AppError('Hurdaya ayrılmış eşya ödünç verilemez.', 409);

    let borrowerName = '';
    let targetEmpId: string | null = null;

    if (data.employeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (emp) {
        targetEmpId = emp.id;
        borrowerName = `${emp.firstName} ${emp.lastName}${emp.department ? ` (${emp.department})` : ''}`;
      }
    }

    if (!borrowerName) {
      const rawCustom = data.customBorrowerName?.trim() || data.notes?.trim();
      if (!rawCustom) throw new AppError('Zimmet verilecek personel adı veya kişi bilgisi zorunludur.', 400);
      borrowerName = rawCustom;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.sharedAsset.update({
        where: { id: assetId },
        data: {
          status: 'LOANED',
          currentHolderType: 'EMPLOYEE',
          currentEmployeeId: targetEmpId,
          currentRoomId: null,
          borrowedAt: new Date(),
          expectedReturnDate: null,
        },
        include: {
          currentEmployee: true,
          currentRoom: { include: { block: true } },
          logs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

      await tx.sharedAssetLog.create({
        data: {
          assetId,
          action: 'CHECK_OUT',
          borrowerName,
          notes: data.notes?.trim() || null,
          createdById: data.createdById || null,
        },
      });

      return updated;
    });
  }

  public static async checkInAsset(
    assetId: string,
    data: {
      locationNote?: string;
      notes?: string;
      createdById?: string;
      newStatus?: SharedAssetStatus;
    }
  ) {
    const asset = await prisma.sharedAsset.findUnique({
      where: { id: assetId },
      include: { currentEmployee: true, currentRoom: { include: { block: true } } },
    });
    if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);

    const borrowerName = asset.currentEmployee
      ? `${asset.currentEmployee.firstName} ${asset.currentEmployee.lastName}`
      : asset.currentRoom
      ? `${asset.currentRoom.block.name} / Oda ${asset.currentRoom.roomNumber}`
      : 'Teslim Alındı';

    const targetStatus = data.newStatus || 'AVAILABLE';

    return prisma.$transaction(async (tx) => {
      const activeLog = await tx.sharedAssetLog.findFirst({
        where: { assetId, action: 'CHECK_OUT', returnedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (activeLog) {
        await tx.sharedAssetLog.update({
          where: { id: activeLog.id },
          data: {
            returnedAt: new Date(),
            notes: data.notes?.trim() ? `Teslim Alındı: ${data.notes.trim()}` : activeLog.notes,
          },
        });
      }

      const updated = await tx.sharedAsset.update({
        where: { id: assetId },
        data: {
          status: targetStatus,
          currentHolderType: null,
          currentEmployeeId: null,
          currentRoomId: null,
          borrowedAt: null,
          expectedReturnDate: null,
          locationNote: data.locationNote?.trim() || asset.locationNote || 'Ana Depo',
        },
        include: {
          currentEmployee: true,
          currentRoom: { include: { block: true } },
          logs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

      await tx.sharedAssetLog.create({
        data: {
          assetId,
          action: 'CHECK_IN',
          borrowerName,
          employeeId: asset.currentEmployeeId,
          roomId: asset.currentRoomId,
          returnedAt: new Date(),
          notes: data.notes?.trim() || 'Teslim Alındı',
          createdById: data.createdById || null,
        },
      });

      return updated;
    });
  }

  public static async updateAssetStatus(
    assetId: string,
    data: {
      status: SharedAssetStatus;
      locationNote?: string;
      notes?: string;
      createdById?: string;
    }
  ) {
    const asset = await prisma.sharedAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);

    return prisma.$transaction(async (tx) => {
      const updated = await tx.sharedAsset.update({
        where: { id: assetId },
        data: {
          status: data.status,
          locationNote: data.locationNote?.trim() || asset.locationNote,
          notes: data.notes?.trim() || asset.notes,
        },
        include: {
          currentEmployee: true,
          currentRoom: { include: { block: true } },
          logs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

      const action = data.status === 'MAINTENANCE' ? 'MAINTENANCE_START' : data.status === 'AVAILABLE' ? 'MAINTENANCE_END' : 'STATUS_CHANGE';

      await tx.sharedAssetLog.create({
        data: {
          assetId,
          action,
          notes: data.notes?.trim() || `Durum güncellendi: ${data.status}`,
          createdById: data.createdById || null,
        },
      });

      return updated;
    });
  }

  public static async addMaintenanceLog(
    assetId: string,
    data: {
      action: 'MAINTENANCE_START' | 'MAINTENANCE_END' | 'FAULT_REPORTED' | 'REPAIR_COMPLETED';
      notes: string;
      newStatus?: SharedAssetStatus;
      createdById?: string;
    }
  ) {
    const asset = await prisma.sharedAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError('Ortak eşya bulunamadı.', 404);

    const targetStatus = data.newStatus || (data.action === 'MAINTENANCE_START' || data.action === 'FAULT_REPORTED' ? 'MAINTENANCE' : 'AVAILABLE');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.sharedAsset.update({
        where: { id: assetId },
        data: { status: targetStatus },
        include: {
          currentEmployee: true,
          currentRoom: { include: { block: true } },
          logs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });

      await tx.sharedAssetLog.create({
        data: {
          assetId,
          action: data.action,
          notes: data.notes.trim(),
          createdById: data.createdById || null,
        },
      });

      return updated;
    });
  }
}
