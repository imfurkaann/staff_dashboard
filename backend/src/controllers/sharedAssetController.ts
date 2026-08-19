import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { SharedAssetService } from '../services/sharedAssetService';
import { permissions, hasPermission } from '../security/permissions';
import {
  sharedAssetBody, sharedAssetId, sharedAssetPage, sharedAssetQuery, sharedAssetRequestKey, sharedAssetStatus,
} from '../security/sharedAssetPolicy';

const actorId = (req: AuthenticatedRequest) => req.user?.id;
const requestKey = (req: AuthenticatedRequest) => sharedAssetRequestKey(req.get('X-Idempotency-Key'));

export class SharedAssetController {
  public static async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const canManage = hasPermission(req.user?.role, permissions.SHARED_ASSET_MANAGE);
      res.json({ success: true, data: await SharedAssetService.getOverview(canManage) });
    } catch (error) { next(error); }
  }

  public static async getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const assetId = sharedAssetQuery(req.query.assetId, 'Ortak eşya filtresi');
      if (assetId) sharedAssetId(assetId, 'Ortak eşya filtresi');
      const data = await SharedAssetService.getLogs({
        assetId,
        search: sharedAssetQuery(req.query.search, 'Arama filtresi'),
        action: sharedAssetQuery(req.query.action, 'İşlem türü filtresi'),
        holderType: sharedAssetQuery(req.query.holderType, 'Zimmet türü filtresi'),
        dateStart: sharedAssetQuery(req.query.dateStart, 'Başlangıç tarihi'),
        dateEnd: sharedAssetQuery(req.query.dateEnd, 'Bitiş tarihi'),
        page: sharedAssetPage(req.query.page, 'Sayfa', 1),
        pageSize: Math.min(sharedAssetPage(req.query.pageSize, 'Sayfa boyutu', 50), 100),
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }

  public static async createAsset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = sharedAssetBody(req.body);
      sharedAssetId(body.stockItemId, 'Stok kartı kimliği');
      const asset = await SharedAssetService.createAsset({ ...body, createdById: actorId(req), requestKey: requestKey(req) });
      res.status(201).json({ success: true, message: 'Ortak eşya stok kartına bağlı olarak kaydedildi.', data: asset });
    } catch (error) { next(error); }
  }

  public static async checkOutAsset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = sharedAssetBody(req.body);
      sharedAssetId(req.params.id);
      if (body.employeeId) sharedAssetId(body.employeeId, 'Personel kimliği');
      if (body.roomId) sharedAssetId(body.roomId, 'Oda kimliği');
      const updated = await SharedAssetService.checkOutAsset(req.params.id, { ...body, createdById: actorId(req), requestKey: requestKey(req) } as any);
      res.json({ success: true, message: 'Ortak eşya ve bağlı stok zimmeti oluşturuldu.', data: updated });
    } catch (error) { next(error); }
  }

  public static async checkInAsset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sharedAssetId(req.params.id);
      const updated = await SharedAssetService.checkInAsset(req.params.id, { ...sharedAssetBody(req.body), createdById: actorId(req), requestKey: requestKey(req) } as any);
      res.json({ success: true, message: 'Ortak eşya teslim alındı ve bağlı stok zimmeti kapatıldı.', data: updated });
    } catch (error) { next(error); }
  }

  public static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sharedAssetId(req.params.id);
      const body = sharedAssetBody(req.body);
      const updated = await SharedAssetService.updateAssetStatus(req.params.id, {
        ...body, status: sharedAssetStatus(body.status), createdById: actorId(req), requestKey: requestKey(req),
      });
      res.json({ success: true, message: 'Ortak eşya durumu denetim geçmişiyle güncellendi.', data: updated });
    } catch (error) { next(error); }
  }

  public static async addMaintenanceLog(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sharedAssetId(req.params.id);
      const body = sharedAssetBody(req.body);
      const updated = await SharedAssetService.addMaintenanceLog(req.params.id, {
        ...body, createdById: actorId(req), requestKey: requestKey(req),
      } as any);
      res.json({ success: true, message: 'Bakım/arıza işlemi denetim geçmişine eklendi.', data: updated });
    } catch (error) { next(error); }
  }

  public static async deleteLog(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sharedAssetId(req.params.logId, 'İşlem kaydı kimliği');
      await SharedAssetService.deleteLog(req.params.logId);
      res.json({ success: true, message: 'İşlem kaydı silindi.' });
    } catch (error) { next(error); }
  }

  public static async updateLog(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sharedAssetId(req.params.logId, 'İşlem kaydı kimliği');
      const updated = await SharedAssetService.updateLog(req.params.logId, req.body);
      res.json({ success: true, message: 'İşlem kaydı güncellendi.', data: updated });
    } catch (error) { next(error); }
  }
}
