import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { UserManagementService } from '../services/userManagementService';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const userManagementController = {
  list: async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await UserManagementService.listUsers() }); } catch (error) { next(error); }
  },
  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await UserManagementService.createUser(req.body || {}, req.user!.id);
      res.status(201).json({ success: true, data: user, message: 'Kullanıcı hesabı güvenli şekilde oluşturuldu.' });
    } catch (error) { next(error); }
  },
  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz kullanıcı kimliği.' });
      const user = await UserManagementService.updateUser(req.params.id, req.body || {}, req.user!.id);
      res.json({ success: true, data: user, message: 'Kullanıcı hesabı ve rolü güncellendi.' });
    } catch (error) { next(error); }
  },
  resetPassword: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz kullanıcı kimliği.' });
      await UserManagementService.resetPassword(req.params.id, req.body?.password, req.user!.id);
      res.json({ success: true, message: 'Parola yenilendi; kullanıcının mevcut oturumları geçersiz hale getirildi.' });
    } catch (error) { next(error); }
  },
};
