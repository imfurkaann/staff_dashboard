import { Response, NextFunction } from 'express';
import { PortalService } from '../services/portalService';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { PushService } from '../services/pushService';
import { AppError } from '../middleware/errorHandler';

export class PortalController {
  public static async getPushPublicKey(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ success: true, data: { publicKey: PushService.getPublicKey() } });
    } catch (error) { next(error); }
  }

  public static async subscribePush(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await PushService.subscribe(req.user!.id, req.body, req.get('user-agent'));
      res.status(201).json({ success: true, message: 'Telefon bildirimi etkinleştirildi.' });
    } catch (error) { next(error); }
  }

  public static async unsubscribePush(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await PushService.unsubscribe(req.user!.id, req.body?.endpoint);
      res.status(200).json({ success: true });
    } catch (error) { next(error); }
  }

  public static async testPush(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PushService.sendToUsers([req.user!.id], {
        title: 'TELEFON BİLDİRİMLERİ AÇILDI',
        body: 'Bu test bildirimini görüyorsanız telefon bildirimi bağlantınız çalışıyor.',
        priority: 'NORMAL',
        url: '/?tab=notifications',
      });
      if (result.disabled) throw new AppError('Push bildirimleri sunucuda yapılandırılmamış.', 503);
      if (result.sent === 0) {
        throw new AppError(result.failed > 0 ? 'Test bildirimi Apple servisine teslim edilemedi.' : 'Bu kullanıcıya ait kayıtlı cihaz bulunamadı.', 409);
      }
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }
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
  }}
