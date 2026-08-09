import { NotificationPriority, NotificationTargetType } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { boundedText } from '../utils/normalization';
import { PushService } from './pushService';

export interface SendNotificationDTO {
  title: string;
  message: string;
  priority?: NotificationPriority;
  targetType: NotificationTargetType;
  targetValue?: string; // Block ID/Name, Department Name, or JSON Array of User IDs
  createdById?: string;
}

export class NotificationService {
  /**
   * Send notification to targeted audience (ALL, BLOCK, DEPARTMENT, SPECIFIC_USERS)
   */
  public static async sendNotification(data: SendNotificationDTO) {
    const { title, message, priority = 'NORMAL', targetType, targetValue, createdById } = data;

    const normalizedTitle = boundedText(title, 'Bildirim başlığı', 120, { required: true, casing: 'upper' })!;
    const normalizedMessage = boundedText(message, 'Bildirim mesajı', 2000, { required: true, casing: 'upper' })!;
    if (!Object.values(NotificationPriority).includes(priority)) throw new AppError('Geçersiz bildirim önceliği.', 400);
    if (!Object.values(NotificationTargetType).includes(targetType)) throw new AppError('Geçersiz hedef kitle türü.', 400);

    // Resolve target User IDs
    let targetUserIds: string[] = [];

    if (targetType === 'ALL') {
      const users = await prisma.user.findMany({
        where: { isActive: true, role: 'STAFF' },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else if (targetType === 'BLOCK') {
      if (!targetValue || !targetValue.trim()) {
        throw new AppError('Lütfen en az bir lojman bloğu seçiniz.', 400);
      }

      let blocksToFilter: string[] = [];
      try {
        if (targetValue.trim().startsWith('[')) {
          blocksToFilter = JSON.parse(targetValue);
        } else {
          blocksToFilter = targetValue.split(',').map(b => b.trim()).filter(Boolean);
        }
      } catch {
        blocksToFilter = targetValue.split(',').map(b => b.trim()).filter(Boolean);
      }

      // Find employees occupying beds in the specified blocks
      const beds = await prisma.bed.findMany({
        where: {
          isOccupied: true,
          currentEmployeeId: { not: null },
          room: {
            OR: [
              { blockId: { in: blocksToFilter } },
              { block: { name: { in: blocksToFilter, mode: 'insensitive' } } },
            ],
          },
        },
        include: {
          currentEmployee: {
            select: { userId: true },
          },
        },
      });

      const userIdsSet = new Set<string>();
      beds.forEach((bed) => {
        if (bed.currentEmployee?.userId) {
          userIdsSet.add(bed.currentEmployee.userId);
        }
      });
      targetUserIds = Array.from(userIdsSet);
    } else if (targetType === 'DEPARTMENT') {
      if (!targetValue || !targetValue.trim()) {
        throw new AppError('Lütfen en az bir departman seçiniz.', 400);
      }

      let deptsToFilter: string[] = [];
      try {
        if (targetValue.trim().startsWith('[')) {
          deptsToFilter = JSON.parse(targetValue);
        } else {
          deptsToFilter = targetValue.split(',').map(d => d.trim()).filter(Boolean);
        }
      } catch {
        deptsToFilter = targetValue.split(',').map(d => d.trim()).filter(Boolean);
      }

      const employees = await prisma.employee.findMany({
        where: {
          department: { in: deptsToFilter, mode: 'insensitive' },
          isDeleted: false,
          userId: { not: null },
        },
        select: { userId: true },
      });

      targetUserIds = employees
        .map((e) => e.userId)
        .filter((id): id is string => Boolean(id));
    } else if (targetType === 'GENDER') {
      if (!targetValue || !['Male', 'Female'].includes(targetValue.trim())) {
        throw new AppError('Lütfen geçerli bir cinsiyet seçiniz.', 400);
      }

      const employees = await prisma.employee.findMany({
        where: {
          gender: { equals: targetValue.trim(), mode: 'insensitive' },
          isDeleted: false,
          userId: { not: null },
        },
        select: { userId: true },
      });

      targetUserIds = employees
        .map((e) => e.userId)
        .filter((id): id is string => Boolean(id));
    } else if (targetType === 'SPECIFIC_USERS') {
      if (!targetValue || !targetValue.trim()) {
        throw new AppError('Lütfen en az bir personel/kullanıcı seçiniz.', 400);
      }

      try {
        if (targetValue.startsWith('[')) {
          targetUserIds = JSON.parse(targetValue);
        } else {
          targetUserIds = targetValue.split(',').map((id) => id.trim()).filter(Boolean);
        }
      } catch (_e) {
        targetUserIds = targetValue.split(',').map((id) => id.trim()).filter(Boolean);
      }
    } else {
      throw new AppError('Geçersiz hedef kitle türü.', 400);
    }

    // Filter out duplicates and invalid IDs
    targetUserIds = Array.from(new Set(targetUserIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    if (targetUserIds.length > 1000) throw new AppError('Tek seferde en fazla 1000 özel kullanıcı seçilebilir.', 400);

    const validUsers = await prisma.user.findMany({
      where: { id: { in: targetUserIds }, isActive: true, role: 'STAFF' },
      select: { id: true },
    });
    targetUserIds = validUsers.map((user) => user.id);

    if (targetUserIds.length === 0) {
      throw new AppError('Seçilen filtre kriterine uyan kayıtlı personel kullanıcısı bulunamadı.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          title: normalizedTitle,
          message: normalizedMessage,
          priority,
          targetType,
          targetValue: targetValue || null,
          createdById: createdById || null,
        },
      });

      await tx.notificationRecipient.createMany({
        data: targetUserIds.map((userId) => ({
          notificationId: notification.id,
          userId,
        })),
        skipDuplicates: true,
      });

      return {
        ...notification,
        recipientCount: targetUserIds.length,
      };
    });

    const pushDelivery = await PushService.sendToUsers(targetUserIds, {
      title: result.title,
      body: result.message,
      priority: result.priority,
      notificationId: result.id,
      url: '/?tab=notifications',
    });

    return { ...result, pushDelivery };
  }

  /**
   * Get list of sent notifications with dynamic filtering and statistics for management view
   */
  public static async getSentNotifications(query: any = {}) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 25);
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safePageSize = Number.isInteger(pageSize) ? Math.min(Math.max(pageSize, 1), 100) : 25;

    const where: any = { isDeleted: false };

    if (query.search && query.search.trim()) {
      const searchPattern = query.search.trim();
      where.OR = [
        { title: { contains: searchPattern, mode: 'insensitive' } },
        { message: { contains: searchPattern, mode: 'insensitive' } },
      ];
    }

    if (query.priority && query.priority !== 'ALL') {
      where.priority = query.priority;
    }

    if (query.targetType && query.targetType !== 'ALL') {
      where.targetType = query.targetType;
    }

    if (query.sender && query.sender.trim()) {
      const senderPattern = query.sender.trim();
      where.createdBy = {
        OR: [
          { fullName: { contains: senderPattern, mode: 'insensitive' } },
          { username: { contains: senderPattern, mode: 'insensitive' } },
        ],
      };
    }

    if (query.dateStart || query.dateEnd) {
      where.createdAt = {
        ...(query.dateStart ? { gte: new Date(query.dateStart) } : {}),
        ...(query.dateEnd ? { lte: new Date(query.dateEnd) } : {}),
      };
    }

    const [notifications, totalFiltered, total, normalCount, importantCount, urgentCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, role: true },
          },
          recipients: {
            include: {
              user: { select: { id: true, fullName: true, username: true } },
            },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { isDeleted: false } }),
      prisma.notification.count({ where: { isDeleted: false, priority: 'NORMAL' } }),
      prisma.notification.count({ where: { isDeleted: false, priority: 'IMPORTANT' } }),
      prisma.notification.count({ where: { isDeleted: false, priority: 'URGENT' } }),
    ]);

    const items = notifications.map((item) => {
      const totalRecipients = item.recipients.length;
      const recipientNames = item.recipients.map((r) => `${r.user.fullName} (@${r.user.username})`).join(', ');
      const recipientsList = item.recipients.map((r) => ({
        fullName: r.user.fullName,
        username: r.user.username,
      }));

      return {
        id: item.id,
        title: item.title,
        message: item.message,
        priority: item.priority,
        targetType: item.targetType,
        targetValue: item.targetValue,
        createdAt: item.createdAt,
        senderName: item.createdBy ? `${item.createdBy.fullName} (@${item.createdBy.username})` : 'Sistem Yöneticisi',
        totalRecipients,
        recipientNames,
        recipients: recipientsList,
      };
    });
    return { 
      items, 
      summary: {
        totalCount: total,
        normalCount,
        importantCount,
        urgentCount,
      },
      pagination: { 
        page: safePage, 
        pageSize: safePageSize, 
        total: totalFiltered, 
        totalPages: Math.ceil(totalFiltered / safePageSize) 
      } 
    };
  }

  /**
   * Delete notification record
   */
  public static async deleteNotification(notificationId: string, deletedById: string) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date(), deletedById },
    });
    if (result.count === 0) throw new AppError('Bildirim bulunamadı veya daha önce arşivlenmiş.', 404);
    return { success: true, message: 'Bildirim aktif listeden kaldırıldı; denetim kaydı korundu.' };
  }

  /**
   * Get notifications for a specific user (Staff Portal view)
   */
  public static async getUserNotifications(userId: string) {
    const [recipients, total] = await prisma.$transaction([
      prisma.notificationRecipient.findMany({
        where: { userId, notification: { isDeleted: false } },
        take: 100,
        include: {
          notification: {
            include: {
              createdBy: { select: { fullName: true } },
            },
          },
        },
        orderBy: { notification: { createdAt: 'desc' } },
      }),
      prisma.notificationRecipient.count({ where: { userId, notification: { isDeleted: false } } }),
    ]);

    const items = recipients.map((r) => ({
      recipientId: r.id,
      notificationId: r.notificationId,
      title: r.notification.title,
      message: r.notification.message,
      priority: r.notification.priority,
      createdAt: r.notification.createdAt,
      senderName: r.notification.createdBy?.fullName || 'Lojman Yönetimi',
    }));

    return {
      total,
      hasMore: total > recipients.length,
      items,
    };
  }
}
