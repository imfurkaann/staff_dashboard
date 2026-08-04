import { Response, NextFunction } from 'express';
import { VisitorService, VisitorFilters } from '../services/visitorService';
import { createVisitorWorkbook } from '../services/visitorExportService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { config } from '../config';

function textQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function filtersFromRequest(req: AuthenticatedRequest): VisitorFilters {
  const requestedStatus = textQuery(req.query.status);
  const includeDeleted = req.query.includeDeleted === 'true' || requestedStatus === 'DELETED' || requestedStatus === 'WITH_DELETED';
  return {
    search: textQuery(req.query.search),
    visitorName: textQuery(req.query.visitorName),
    company: textQuery(req.query.company),
    hostName: textQuery(req.query.hostName),
    purpose: textQuery(req.query.purpose),
    phone: textQuery(req.query.phone),
    vehiclePlate: textQuery(req.query.vehiclePlate),
    status: requestedStatus,
    dateStart: textQuery(req.query.dateStart),
    dateEnd: textQuery(req.query.dateEnd),
    hostEmployeeId: textQuery(req.query.hostEmployeeId),
    includeDeleted,
    page: positiveInteger(req.query.page),
    pageSize: positiveInteger(req.query.pageSize),
    sortBy: textQuery(req.query.sortBy),
    sortOrder: textQuery(req.query.sortOrder),
  };
}

export class VisitorController {
  public static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await VisitorService.getAllVisitors(filtersFromRequest(req));
      res.status(200).json({ success: true, data: result.items, pagination: result.pagination, summary: result.summary });
    } catch (error) { next(error); }
  }

  public static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const includeDeleted = (req.user?.role === 'ADMIN' || req.user?.role === 'HOUSING_MANAGER') && req.query.includeDeleted === 'true';
      const visitor = await VisitorService.getVisitorById(req.params.id, includeDeleted);
      res.status(200).json({ success: true, data: visitor });
    } catch (error) { next(error); }
  }

  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const visitor = await VisitorService.createVisitor(req.body, req.user!.id);
      res.status(201).json({ success: true, message: 'Ziyaretçi girişi kaydedildi.', data: visitor });
    } catch (error) { next(error); }
  }

  public static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const visitor = await VisitorService.updateVisitor(req.params.id, req.body, req.user!.id);
      res.status(200).json({ success: true, message: 'Ziyaretçi bilgileri güncellendi.', data: visitor });
    } catch (error) { next(error); }
  }

  public static async checkOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const visitor = await VisitorService.checkOutVisitor(req.params.id, req.user!.id);
      res.status(200).json({ success: true, message: 'Ziyaretçi çıkışı kaydedildi.', data: visitor });
    } catch (error) { next(error); }
  }

  public static async undoCheckOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const visitor = await VisitorService.undoCheckOutVisitor(req.params.id, req.user!.id);
      res.status(200).json({ success: true, message: 'Ziyaretçi çıkışı geri alındı.', data: visitor });
    } catch (error) { next(error); }
  }

  public static async restore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const visitor = await VisitorService.restoreVisitor(req.params.id, req.user!.id);
      res.status(200).json({ success: true, message: 'Ziyaretçi kaydı geri yüklendi.', data: visitor });
    } catch (error) { next(error); }
  }

  public static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await VisitorService.deleteVisitor(req.params.id, req.user!.id);
      res.status(200).json({ success: true, message: 'Ziyaretçi kaydı güvenli biçimde arşivlendi.' });
    } catch (error) { next(error); }
  }

  public static async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rows = await VisitorService.getExportRows(filtersFromRequest(req), config.visitor.exportMaxRows);
      const workbook = await createVisitorWorkbook(rows, req.user!.fullName);
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="ziyaretci-kayitlari-${date}.xlsx"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).send(workbook);
    } catch (error) { next(error); }
  }
}
