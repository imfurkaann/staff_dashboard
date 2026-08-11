import { MaintenancePriority } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { maskTcNo } from '../utils/crypto';
import { NotificationService } from './notificationService';

export class PortalService {
  /**
   * Returns complete portal dashboard data for the authenticated Staff user
   */
  public static async getStaffPortalData(userId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId, isDeleted: false },
      include: {
        user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
        beds: {
          include: {
            room: {
              include: {
                block: true,
              },
            },
          },
        },
        inventories: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
        },
        occupancies: {
          orderBy: { checkInDate: 'desc' },
          take: 1,
          include: {
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
        },
      },
    });

    if (!employee || employee.isDeleted || employee.status === 'CHECKED_OUT' || !employee.user || !employee.user.isActive) {
      throw new AppError('Lojmandan çıkışınız yapıldığı veya hesabınız pasifleştirildiği için sisteme erişim yetkiniz kaldırılmıştır.', 403);
    }

    // Determine current bed & room
    let currentBed = employee.beds.length > 0 ? employee.beds[0] : null;
    let currentRoom = currentBed ? currentBed.room : null;

    if (!currentRoom && employee.occupancies.length > 0 && !employee.occupancies[0].checkOutDate) {
      currentBed = employee.occupancies[0].bed;
      currentRoom = currentBed.room;
    }

    // Roommates details
    let roommates: Array<{
      id: string;
      fullName: string;
      department: string;
      title: string | null;
      shiftType: string | null;
      bedLabel: string;
    }> = [];

    if (currentRoom) {
      const otherBeds = await prisma.bed.findMany({
        where: {
          roomId: currentRoom.id,
          isOccupied: true,
          NOT: { currentEmployeeId: employee.id },
        },
        include: {
          currentEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: true,
              title: true,
              shiftType: true,
            },
          },
        },
      });

      roommates = otherBeds
        .filter((b) => Boolean(b.currentEmployee))
        .map((b) => ({
          id: b.currentEmployee!.id,
          fullName: `${b.currentEmployee!.firstName} ${b.currentEmployee!.lastName}`,
          department: b.currentEmployee!.department,
          title: b.currentEmployee!.title,
          shiftType: b.currentEmployee!.shiftType,
          bedLabel: b.bedLabel,
        }));
    }

    // Safe Employee profile object
    // Notifications
    const notificationData = await NotificationService.getUserNotifications(userId);

    // Filter active inventories assigned to employee
    const activeInventories = employee.inventories.filter((inv) => inv.returnedDate === null);

    return {
      profile: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department,
        title: employee.title,
        phone: employee.phone,
        photoUrl: employee.photoUrl,
        shiftType: employee.shiftType,
        status: employee.status,
        tcNoMasked: maskTcNo(employee.tcNo),
      },
      roomInfo: currentRoom && currentBed ? {
        blockName: currentRoom.block.name,
        genderPolicy: currentRoom.block.genderPolicy,
        floor: currentRoom.floor,
        roomNumber: currentRoom.roomNumber,
        bedLabel: currentBed.bedLabel,
        roomStatus: currentRoom.status,
        capacity: currentRoom.capacity,
      } : null,
      roommates,
      inventories: activeInventories,
      notifications: notificationData,
    };
  }
}
