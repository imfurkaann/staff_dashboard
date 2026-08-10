import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { SharedAssetService } from '../services/sharedAssetService';

export class SharedAssetController {
  public static async getOverview(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const overview = await SharedAssetService.getOverview();
      res.json({ success: true, data: overview });
    } catch (error) {
      res.status((error as any).statusCode || 500).json({ success: false, message: (error as Error).message });
    }
  }

  public static async createAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const asset = await SharedAssetService.createAsset(req.body);
      res.status(201).json({ success: true, message: 'Ortak eşya/ekipman başarıyla kaydedildi.', data: asset });
    } catch (error) {
      res.status((error as any).statusCode || 500).json({ success: false, message: (error as Error).message });
    }
  }

  public static async checkOutAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await SharedAssetService.checkOutAsset(id, {
        ...req.body,
        createdById: req.user?.id,
      });
      res.json({ success: true, message: 'Ortak eşya zimmetlendi.', data: updated });
    } catch (error) {
      res.status((error as any).statusCode || 500).json({ success: false, message: (error as Error).message });
    }
  }

  public static async checkInAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await SharedAssetService.checkInAsset(id, {
        ...req.body,
        createdById: req.user?.id,
      });
      res.json({ success: true, message: 'Ortak eşya teslim alındı.', data: updated });
    } catch (error) {
      res.status((error as any).statusCode || 500).json({ success: false, message: (error as Error).message });
    }
  }

  public static async updateStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await SharedAssetService.updateAssetStatus(id, {
        ...req.body,
        createdById: req.user?.id,
      });
      res.json({ success: true, message: 'Ortak eşya durumu güncellendi.', data: updated });
    } catch (error) {
      res.status((error as any).statusCode || 500).json({ success: false, message: (error as Error).message });
    }
  }

  public static async addMaintenanceLog(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updated = await SharedAssetService.addMaintenanceLog(id, {
        ...req.body,
        createdById: req.user?.id,
      });
      res.json({ success: true, message: 'Bakım/arıza kaydı başarıyla eklendi.', data: updated });
    } catch (error) {
      res.status((error as any).statusCode || 500).json({ success: false, message: (error as Error).message });
    }
  }
}
