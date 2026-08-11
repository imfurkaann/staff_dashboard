import { NotificationPriority, NotificationTargetType, Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { PushService } from './pushService';
import { validateNotificationQuery, validateNotificationSendInput } from '../security/notificationPolicy';
import { buildActiveResidentStaffWhere } from '../security/notificationAudience';

export interface SendNotificationDTO {
  title: string;
  message: string;
  priority?: NotificationPriority;
  targetType: NotificationTargetType;
  targetValue?: string; // Block ID/Name, Department Name, or JSON Array of User IDs
  createdById?: string;
  requestKey: string;
}

export class NotificationService {
  /**
   * Send notification to targeted audience (ALL, BLOCK, DEPARTMENT, SPECIFIC_USERS)
   */
  public static async sendNotification(data: SendNotificationDTO) {
    const input = validateNotificationSendInput(data);
    const { title, message, priority, targetType, targetValue, targetValues } = input;
    const { createdById, requestKey } = data;

    const existing = await prisma.notification.findUnique({
      where: { requestKey },
      include: { _count: { select: { recipients: true } } },
    });
    if (existing) {
      if (existing.createdById !== createdById) throw new AppError('Bu istek anahtarı daha önce kullanılmış.', 409);
      return {
        ...existing,
        recipientCount: existing._count.recipients,
        duplicate: true,
        pushDelivery: { sent: 0, failed: 0, disabled: !PushService.isConfigured(), queued: false },
      };
    }

    // Resolve target User IDs
    let targetUserIds: string[] = [];

    if (targetType === 'ALL') {
      const users = await prisma.user.findMany({
        where: buildActiveResidentStaffWhere(),
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else if (targetType === 'BLOCK') {
      // Find employees occupying beds in the specified blocks
      const beds = await prisma.bed.findMany({
        where: {
          isOccupied: true,
          currentEmployeeId: { not: null },
          room: {
            OR: [
              { blockId: { in: targetValues } },
              { block: { name: { in: targetValues, mode: 'insensitive' } } },
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
      const employees = await prisma.employee.findMany({
        where: {
          department: { in: targetValues, mode: 'insensitive' },
          isDeleted: false,
          userId: { not: null },
        },
        select: { userId: true },
      });

      targetUserIds = employees
        .map((e) => e.userId)
        .filter((id): id is string => Boolean(id));
    } else if (targetType === 'GENDER') {
      const employees = await prisma.employee.findMany({
        where: {
          gender: { equals: targetValues[0], mode: 'insensitive' },
          isDeleted: false,
          userId: { not: null },
        },
        select: { userId: true },
      });

      targetUserIds = employees
        .map((e) => e.userId)
        .filter((id): id is string => Boolean(id));
    } else if (targetType === 'SPECIFIC_USERS') {
      targetUserIds = targetValues;
    } else {
      throw new AppError('Geçersiz hedef kitle türü.', 400);
    }

    // Filter out duplicates and invalid IDs
    targetUserIds = Array.from(new Set(targetUserIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    if (targetUserIds.length > 10_000) throw new AppError('Tek bir duyuru en fazla 10.000 kullanıcıya gönderilebilir.', 400);

    const validUsers = await prisma.user.findMany({
      where: buildActiveResidentStaffWhere(targetUserIds),
      select: { id: true },
    });
    targetUserIds = validUsers.map((user) => user.id);

    if (targetUserIds.length === 0) {
      throw new AppError('Seçilen kriterlere uyan, odada aktif olarak konaklayan ve portal hesabı bulunan personel bulunamadı.', 400);
    }

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const notification = await tx.notification.create({
          data: {
            requestKey,
            title,
            message,
            priority,
            targetType,
            targetValue,
            createdById: createdById || null,
          },
        });

        await tx.notificationRecipient.createMany({
          data: targetUserIds.map((userId) => ({ notificationId: notification.id, userId })),
          skipDuplicates: true,
        });
        return { ...notification, recipientCount: targetUserIds.length };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await prisma.notification.findUnique({
          where: { requestKey },
          include: { _count: { select: { recipients: true } } },
        });
        if (duplicate && duplicate.createdById === createdById) {
          return {
            ...duplicate,
            recipientCount: duplicate._count.recipients,
            duplicate: true,
            pushDelivery: { sent: 0, failed: 0, disabled: !PushService.isConfigured(), queued: false },
          };
        }
      }
      throw error;
    }

    const pushDelivery = PushService.queueToUsers(targetUserIds, {
      title: result.title,
      body: result.message.slice(0, 500),
      priority: result.priority,
      notificationId: result.id,
      url: '/?tab=notifications',
    });

    return { ...result, duplicate: false, pushDelivery };
  }

  /**
   * Get list of sent notifications with dynamic filtering and statistics for management view
   */
  public static async getSentNotifications(query: any = {}) {
    const filters = validateNotificationQuery(query);
    const { page, pageSize, search, sender, priority, targetType, dateStart, dateEnd } = filters;

    const where: any = { isDeleted: false };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (priority) {
      where.priority = priority;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (sender) {
      const senderPattern = sender;
      where.createdBy = {
        OR: [
          { fullName: { contains: senderPattern, mode: 'insensitive' } },
          { username: { contains: senderPattern, mode: 'insensitive' } },
        ],
      };
    }

    if (dateStart || dateEnd) {
      where.createdAt = {
        ...(dateStart ? { gte: dateStart } : {}),
        ...(dateEnd ? { lte: dateEnd } : {}),
      };
    }

    const [notifications, totalFiltered, total, normalCount, importantCount, urgentCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdBy: {
            select: { id: true, fullName: true, username: true, role: true },
          },
          _count: { select: { recipients: true } },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { isDeleted: false } }),
      prisma.notification.count({ where: { isDeleted: false, priority: 'NORMAL' } }),
      prisma.notification.count({ where: { isDeleted: false, priority: 'IMPORTANT' } }),
      prisma.notification.count({ where: { isDeleted: false, priority: 'URGENT' } }),
    ]);

    const items = notifications.map((item) => {
      return {
        id: item.id,
        title: item.title,
        message: item.message,
        priority: item.priority,
        targetType: item.targetType,
        targetValue: item.targetValue,
        createdAt: item.createdAt,
        senderName: item.createdBy ? `${item.createdBy.fullName} (@${item.createdBy.username})` : 'Sistem Yöneticisi',
        totalRecipients: item._count.recipients,
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
        page,
        pageSize,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / pageSize)
      } 
    };
  }

  public static async getNotificationDetail(notificationId: string) {
    const item = await prisma.notification.findFirst({
      where: { id: notificationId, isDeleted: false },
      include: {
        createdBy: { select: { fullName: true, username: true } },
        recipients: {
          orderBy: { user: { fullName: 'asc' } },
          select: { user: { select: { fullName: true, username: true } } },
        },
      },
    });
    if (!item) throw new AppError('Duyuru bulunamadı.', 404);
    return {
      id: item.id,
      title: item.title,
      message: item.message,
      priority: item.priority,
      targetType: item.targetType,
      targetValue: item.targetValue,
      createdAt: item.createdAt,
      senderName: item.createdBy ? `${item.createdBy.fullName} (@${item.createdBy.username})` : 'Sistem Yöneticisi',
      totalRecipients: item.recipients.length,
      recipients: item.recipients.map(({ user }) => user),
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
