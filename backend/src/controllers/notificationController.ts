import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class NotificationController {
  /**
   * POST /api/notifications/send
   */
  public static async send(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const createdById = req.user!.id;
      const { title, message, priority, targetType, targetValue } = req.body;

      const result = await NotificationService.sendNotification({
        title,
        message,
        priority,
        targetType,
        targetValue,
        createdById,
      });

      res.status(201).json({
        success: true,
        message: result.pushDelivery.disabled
          ? `Bildirim ${result.recipientCount} kullanıcıya site içinde iletildi; telefon bildirim servisi sunucuda kapalı.`
          : result.pushDelivery.sent > 0
          ? `Bildirim ${result.recipientCount} kullanıcıya site içinde iletildi; ${result.pushDelivery.sent} kayıtlı cihaza telefon bildirimi gönderildi${result.pushDelivery.failed > 0 ? `, ${result.pushDelivery.failed} cihazda başarısız oldu` : ''}.`
          : result.pushDelivery.failed > 0
            ? `Bildirim ${result.recipientCount} kullanıcıya site içinde iletildi; telefon bildirimi ${result.pushDelivery.failed} cihazda başarısız oldu.`
            : `Bildirim ${result.recipientCount} kullanıcıya site içinde iletildi; hedef kullanıcıların kayıtlı telefonu olmadığı için telefon bildirimi gönderilmedi.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications
   */
  public static async getAllSent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || 25);
      const result = await NotificationService.getSentNotifications(page, pageSize);

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/notifications/:id
   */
  public static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await NotificationService.deleteNotification(id, req.user!.id);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
