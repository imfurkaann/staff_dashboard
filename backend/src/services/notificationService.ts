import { NotificationPriority, NotificationTargetType } from '@prisma/client';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';

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

    if (!title || !title.trim()) {
      throw new AppError('Bildirim başlığı zorunludur.', 400);
    }
    if (!message || !message.trim()) {
      throw new AppError('Bildirim mesajı zorunludur.', 400);
    }

    // Resolve target User IDs
    let targetUserIds: string[] = [];

    if (targetType === 'ALL') {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      targetUserIds = users.map((u) => u.id);
    } else if (targetType === 'BLOCK') {
      if (!targetValue || !targetValue.trim()) {
        throw new AppError('Lütfen bildirimin gönderileceği bloğu seçiniz.', 400);
      }

      // Find employees occupying beds in the specified block
      const beds = await prisma.bed.findMany({
        where: {
          isOccupied: true,
          currentEmployeeId: { not: null },
          room: {
            OR: [
              { blockId: targetValue },
              { block: { name: targetValue } },
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
        throw new AppError('Lütfen bildirimin gönderileceği departmanı seçiniz.', 400);
      }

      const employees = await prisma.employee.findMany({
        where: {
          department: targetValue.trim(),
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
    }

    // Filter out duplicates and invalid IDs
    targetUserIds = Array.from(new Set(targetUserIds));

    if (targetUserIds.length === 0) {
      throw new AppError('Seçilen filtre kriterine uyan kayıtlı personel kullanıcısı bulunamadı.', 400);
    }

    return prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          title: title.trim(),
          message: message.trim(),
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
  }

  /**
   * Get list of sent notifications with statistics for management view
   */
  public static async getSentNotifications() {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
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
    });

    return notifications.map((item) => {
      const totalRecipients = item.recipients.length;
      const readCount = item.recipients.filter((r) => r.isRead).length;
      const readRatio = totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0;
      const recipientNames = item.recipients.map((r) => `${r.user.fullName} (@${r.user.username})`).join(', ');

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
        readCount,
        readRatio,
        recipientNames,
      };
    });
  }

  /**
   * Delete notification record
   */
  public static async deleteNotification(notificationId: string) {
    const existing = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!existing) throw new AppError('Bildirim bulunamadı.', 404);

    await prisma.notification.delete({ where: { id: notificationId } });
    return { success: true, message: 'Bildirim silindi.' };
  }

  /**
   * Get notifications for a specific user (Staff Portal view)
   */
  public static async getUserNotifications(userId: string) {
    const recipients = await prisma.notificationRecipient.findMany({
      where: { userId },
      include: {
        notification: {
          include: {
            createdBy: { select: { fullName: true } },
          },
        },
      },
      orderBy: { notification: { createdAt: 'desc' } },
    });

    const unreadCount = recipients.filter((r) => !r.isRead).length;

    const items = recipients.map((r) => ({
      recipientId: r.id,
      notificationId: r.notificationId,
      title: r.notification.title,
      message: r.notification.message,
      priority: r.notification.priority,
      createdAt: r.notification.createdAt,
      senderName: r.notification.createdBy?.fullName || 'Lojman Yönetimi',
      isRead: r.isRead,
      readAt: r.readAt,
    }));

    return {
      unreadCount,
      items,
    };
  }

  /**
   * Mark a single notification recipient record as read
   */
  public static async markAsRead(recipientId: string, userId: string) {
    const recipient = await prisma.notificationRecipient.findUnique({
      where: { id: recipientId },
    });

    if (!recipient || recipient.userId !== userId) {
      throw new AppError('Bildirim kaydı bulunamadı veya bu işlem için yetkiniz yok.', 404);
    }

    return prisma.notificationRecipient.update({
      where: { id: recipientId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications for a user as read
   */
  public static async markAllAsRead(userId: string) {
    await prisma.notificationRecipient.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { success: true, message: 'Tüm bildirimler okundu olarak işaretlendi.' };
  }
}
