import { Response, NextFunction } from 'express';
import { PortalService } from '../services/portalService';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class PortalController {
  /**
   * GET /api/portal/me
   */
  public static async getMyPortalData(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data = await PortalService.getStaffPortalData(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/portal/notifications/:recipientId/read
   */
  public static async markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { recipientId } = req.params;

      const result = await NotificationService.markAsRead(recipientId, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/portal/notifications/read-all
   */
  public static async markAllNotificationsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await NotificationService.markAllAsRead(userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
