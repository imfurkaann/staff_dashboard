import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { UserManagementService } from '../services/userManagementService';
import { parseUserListFilters, validateUserId } from '../security/userManagementPolicy';

export const userManagementController = {
  list: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const filters = parseUserListFilters(req.query as Record<string, unknown>);
      res.json({ success: true, data: await UserManagementService.listUsers(filters) });
    } catch (error) { next(error); }
  },
  roles: async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: UserManagementService.getRoleCatalog() }); } catch (error) { next(error); }
  },
  get: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = validateUserId(req.params.id);
      res.json({ success: true, data: await UserManagementService.getUser(id) });
    } catch (error) { next(error); }
  },
  create: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await UserManagementService.createUser(req.body || {}, req.user!.id);
      res.status(201).json({ success: true, data: user, message: 'Kullanıcı hesabı güvenli şekilde oluşturuldu.' });
    } catch (error) { next(error); }
  },
  update: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = validateUserId(req.params.id);
      const user = await UserManagementService.updateUser(id, req.body || {}, req.user!.id);
      res.json({ success: true, data: user, message: 'Kullanıcı hesabı ve rolü güncellendi.' });
    } catch (error) { next(error); }
  },
  resetPassword: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = validateUserId(req.params.id);
      await UserManagementService.resetPassword(id, req.body?.password, req.user!.id);
      res.json({ success: true, message: 'Parola yenilendi; kullanıcının mevcut oturumları geçersiz hale getirildi.' });
    } catch (error) { next(error); }
  },
};
