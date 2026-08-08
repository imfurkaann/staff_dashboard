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
        message: `Bildirim ${result.recipientCount} personele/kullanıcıya başarıyla gönderildi.`,
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
      const notifications = await NotificationService.getSentNotifications();

      res.status(200).json({
        success: true,
        data: notifications,
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
      const result = await NotificationService.deleteNotification(id);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
