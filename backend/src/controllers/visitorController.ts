import { Response, NextFunction } from 'express';
import { VisitorService, VisitorFilters } from '../services/visitorService';
import { createVisitorWorkbook } from '../services/visitorExportService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { hasPermission, permissions } from '../security/permissions';

function textQuery(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new AppError(`${fieldName} tek bir metin değeri olmalıdır.`, 400);
  return value;
}

function positiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new AppError(`${fieldName} pozitif tam sayı olmalıdır.`, 400);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new AppError(`${fieldName} güvenli sayı aralığında olmalıdır.`, 400);
  return parsed;
}

function filtersFromRequest(req: AuthenticatedRequest): VisitorFilters {
  const requestedStatus = textQuery(req.query.status, 'Durum filtresi');
  const includeDeleted = req.query.includeDeleted === 'true' || requestedStatus === 'DELETED' || requestedStatus === 'WITH_DELETED';
  if (req.query.includeDeleted !== undefined && req.query.includeDeleted !== 'true' && req.query.includeDeleted !== 'false') {
    throw new AppError('Silinmiş kayıt filtresi true veya false olmalıdır.', 400);
  }
  if (includeDeleted && !hasPermission(req.user?.role, permissions.VISITOR_ARCHIVE)) {
    throw new AppError('Arşivlenmiş ziyaretçi kayıtlarını görüntüleme yetkiniz bulunmamaktadır.', 403);
  }
  return {
    search: textQuery(req.query.search, 'Arama'),
    visitorName: textQuery(req.query.visitorName, 'Ziyaretçi adı filtresi'),
    company: textQuery(req.query.company, 'Firma filtresi'),
    hostName: textQuery(req.query.hostName, 'Personel filtresi'),
    purpose: textQuery(req.query.purpose, 'Amaç filtresi'),
    phone: textQuery(req.query.phone, 'Telefon filtresi'),
    vehiclePlate: textQuery(req.query.vehiclePlate, 'Plaka filtresi'),
    status: requestedStatus,
    dateStart: textQuery(req.query.dateStart, 'Başlangıç tarihi'),
    dateEnd: textQuery(req.query.dateEnd, 'Bitiş tarihi'),
    hostEmployeeId: textQuery(req.query.hostEmployeeId, 'Personel kimliği'),
    includeDeleted,
    page: positiveInteger(req.query.page, 'Sayfa'),
    pageSize: positiveInteger(req.query.pageSize, 'Sayfa boyutu'),
    sortBy: textQuery(req.query.sortBy, 'Sıralama alanı'),
    sortOrder: textQuery(req.query.sortOrder, 'Sıralama yönü'),
  };
}

export class VisitorController {
  public static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await VisitorService.getAllVisitors(filtersFromRequest(req));
      const summary = hasPermission(req.user?.role, permissions.VISITOR_ARCHIVE)
        ? result.summary
        : { inside: result.summary.inside, overdueInside: result.summary.overdueInside, exited: result.summary.exited };
      res.status(200).json({ success: true, data: result.items, pagination: result.pagination, summary });
    } catch (error) { next(error); }
  }

  public static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const includeDeleted = hasPermission(req.user?.role, permissions.VISITOR_ARCHIVE) && req.query.includeDeleted === 'true';
      const visitor = await VisitorService.getVisitorById(req.params.id, includeDeleted);
      res.status(200).json({ success: true, data: visitor });
    } catch (error) { next(error); }
  }

  public static async getHostCandidates(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ success: true, data: await VisitorService.getHostCandidates() });
    } catch (error) { next(error); }
  }

  public static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const visitor = await VisitorService.createVisitor(req.body, req.user!.id, req.get('x-idempotency-key'));
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
