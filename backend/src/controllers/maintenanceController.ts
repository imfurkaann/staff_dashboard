import { Request, Response, NextFunction } from 'express';
import { maintenanceService } from '../services/maintenanceService';
import { createMaintenanceWorkbook } from '../services/maintenanceExportService';
import { MaintenancePriority, MaintenanceStatus, MaintenanceType, RoomInventoryStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { formatIstanbulDate } from '../utils/dateTime';
import { hasPermission, permissions } from '../security/permissions';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { scopeMaintenanceData } from '../security/dataScope';
import { validateMaintenanceId } from '../security/maintenancePolicy';

const requestBody = (value: unknown): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('İstek gövdesi geçersiz.', 400);
  return value as Record<string, any>;
};
const cleanString = (value: unknown, maxLength: number) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new AppError('Metin alanı geçersiz.', 400);
  const clean = value.trim();
  if (clean.length > maxLength) throw new AppError(`Metin alanı en fazla ${maxLength} karakter olabilir.`, 400);
  return clean;
};
const singleQuery = (value: unknown, name: string): string | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new AppError(`${name} tek bir değer olmalıdır.`, 400);
  return value;
};
const positiveIntegerQuery = (value: unknown, name: string): number | undefined => {
  const raw = singleQuery(value, name);
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) throw new AppError(`${name} pozitif tam sayı olmalıdır.`, 400);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new AppError(`${name} pozitif tam sayı olmalıdır.`, 400);
  return parsed;
};

export const maintenanceController = {
  getMaintenances: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = singleQuery(req.query.status, 'Durum filtresi');
      const priority = singleQuery(req.query.priority, 'Öncelik filtresi');
      const category = singleQuery(req.query.category, 'Kategori filtresi');
      const blockId = singleQuery(req.query.blockId, 'Blok filtresi');
      const search = singleQuery(req.query.search, 'Arama filtresi');
      const dateStart = singleQuery(req.query.dateStart, 'Başlangıç tarihi');
      const dateEnd = singleQuery(req.query.dateEnd, 'Bitiş tarihi');

      if (status && status !== 'ALL' && !Object.values(MaintenanceStatus).includes(String(status) as MaintenanceStatus)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza durumu filtresi.' });
      }

      if (priority && priority !== 'ALL' && !Object.values(MaintenancePriority).includes(String(priority) as MaintenancePriority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği filtresi.' });
      }

      if (blockId) {
        validateMaintenanceId(blockId, 'Blok kimliği');
      }

      const parsedPage = positiveIntegerQuery(req.query.page, 'Sayfa');
      const parsedPageSize = positiveIntegerQuery(req.query.pageSize, 'Sayfa boyutu');

      const result = await maintenanceService.getMaintenances({
        status: status ? (status as MaintenanceStatus | 'ALL') : undefined,
        priority: priority ? (priority as MaintenancePriority | 'ALL') : undefined,
        category,
        blockId,
        search: cleanString(search, 100) || undefined,
        dateStart: dateStart ? String(dateStart) : undefined,
        dateEnd: dateEnd ? String(dateEnd) : undefined,
        page: parsedPage,
        pageSize: parsedPageSize,
      });

      res.status(200).json({ success: true, data: scopeMaintenanceData(result, (req as AuthenticatedRequest).user?.role) });
    } catch (error) {
      next(error);
    }
  },

  createMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const requestKey = req.get('X-Idempotency-Key');
      if (requestKey) validateMaintenanceId(requestKey, 'Tekrar-gönderim anahtarı');
      const {
        roomId,
        type = 'GENERAL',
        roomInventoryId,
        inventoryStatus,
        title,
        description,
        priority = 'MEDIUM',
        category,
        location,
        assignedTo,
      } = requestBody(req.body);

      const cleanTitle = cleanString(title, 100);
      const cleanDescription = cleanString(description, 2000);
      const cleanCategory = cleanString(category, 100);
      const cleanLocation = cleanString(location, 100);
      const cleanAssignedTo = cleanString(assignedTo, 100);

      if (!cleanDescription) {
        return res.status(400).json({
          success: false,
          message: 'Arıza açıklaması zorunludur.',
        });
      }

      if (roomId) validateMaintenanceId(roomId, 'Oda kimliği');

      if (!Object.values(MaintenanceType).includes(type)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza kayıt türü.' });
      }
      if (roomInventoryId) validateMaintenanceId(roomInventoryId, 'Oda demirbaşı kimliği');
      if (inventoryStatus && !Object.values(RoomInventoryStatus).includes(inventoryStatus)) {
        return res.status(400).json({ success: false, message: 'Geçersiz demirbaş durumu.' });
      }
      if (inventoryStatus === 'LOST' && !['ADMIN', 'HOUSING_MANAGER'].includes(req.user?.role || '')) {
        return res.status(403).json({ success: false, message: 'Kayıp / zayi stok düşümü yalnızca yetkili yönetici tarafından onaylanabilir.' });
      }

      if (!Object.values(MaintenancePriority).includes(priority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği.' });
      }

      const maintenance = await maintenanceService.createMaintenance({
        requestKey,
        roomId: roomId ? String(roomId) : undefined,
        type,
        roomInventoryId: roomInventoryId ? String(roomInventoryId) : undefined,
        inventoryStatus,
        title: cleanTitle,
        description: cleanDescription,
        priority,
        category: cleanCategory || undefined,
        location: cleanLocation || undefined,
        reportedBy: req.user?.fullName || 'Lojman Yönetimi',
        assignedTo: cleanAssignedTo || undefined,
        createdById: req.user?.id,
      });

      res.status(201).json({
        success: true,
        data: scopeMaintenanceData(maintenance, req.user?.role),
        message: 'Arıza kaydı başarıyla oluşturuldu.',
      });
    } catch (error) {
      next(error);
    }
  },

  updateMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, description, priority, status, assignedTo, category, location, resolutionNote, inventoryStatus, serviceProvider, serviceReference, laborCost, partsCost, warrantyCovered, sentToServiceAt, returnedFromServiceAt } = requestBody(req.body);

      validateMaintenanceId(id);

      if (priority && !Object.values(MaintenancePriority).includes(priority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği.' });
      }

      if (status && !Object.values(MaintenanceStatus).includes(status)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza durumu.' });
      }
      if (inventoryStatus && !Object.values(RoomInventoryStatus).includes(inventoryStatus)) return res.status(400).json({ success: false, message: 'Geçersiz demirbaş durumu.' });
      if (!hasPermission(req.user?.role, permissions.MAINTENANCE_FULL_UPDATE)
        && [serviceProvider, serviceReference, laborCost, partsCost, warrantyCovered, sentToServiceAt, returnedFromServiceAt].some((value) => value !== undefined)) {
        return res.status(403).json({ success: false, message: 'Servis, maliyet ve garanti bilgilerini yalnızca tam güncelleme yetkili kullanıcı düzenleyebilir.' });
      }
      const parsedLaborCost = laborCost === undefined ? undefined : Number(laborCost);
      const parsedPartsCost = partsCost === undefined ? undefined : Number(partsCost);
      if ((parsedLaborCost !== undefined && (!Number.isFinite(parsedLaborCost) || parsedLaborCost < 0)) || (parsedPartsCost !== undefined && (!Number.isFinite(parsedPartsCost) || parsedPartsCost < 0))) return res.status(400).json({ success: false, message: 'Servis maliyetleri negatif olamaz.' });
      if (warrantyCovered !== undefined && typeof warrantyCovered !== 'boolean') return res.status(400).json({ success: false, message: 'Garanti kapsamı bilgisi geçersiz.' });

      const userSolver = req.user?.fullName || 'Lojman Yönetimi';
      const isClosing = status === 'RESOLVED' || status === 'CLOSED';
      const cleanedAssignedTo = cleanString(assignedTo, 100);
      const targetAssignedTo = assignedTo !== undefined
        ? (cleanedAssignedTo || (isClosing ? userSolver : null))
        : (isClosing ? userSolver : undefined);

      const updated = await maintenanceService.updateMaintenance(id, {
        title: title === undefined ? undefined : cleanString(title, 100),
        description: description === undefined ? undefined : cleanString(description, 2000),
        priority,
        status,
        assignedTo: targetAssignedTo,
        category: category === undefined ? undefined : cleanString(category, 100) || null,
        location: location === undefined ? undefined : cleanString(location, 100) || null,
        resolutionNote: resolutionNote === undefined ? undefined : cleanString(resolutionNote, 1000) || null,
        inventoryStatus,
        serviceProvider: serviceProvider === undefined ? undefined : cleanString(serviceProvider, 150) || null,
        serviceReference: serviceReference === undefined ? undefined : cleanString(serviceReference, 100) || null,
        laborCost: parsedLaborCost,
        partsCost: parsedPartsCost,
        warrantyCovered,
        sentToServiceAt: sentToServiceAt === undefined ? undefined : sentToServiceAt || null,
        returnedFromServiceAt: returnedFromServiceAt === undefined ? undefined : returnedFromServiceAt || null,
        performedBy: userSolver,
        performedById: req.user?.id,
        canFullUpdate: hasPermission(req.user?.role, permissions.MAINTENANCE_FULL_UPDATE),
      });

      res.status(200).json({
        success: true,
        data: scopeMaintenanceData(updated, req.user?.role),
        message: 'Arıza kaydı güncellendi.',
      });
    } catch (error) {
      next(error);
    }
  },

  exportExcel: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const status = singleQuery(req.query.status, 'Durum filtresi');
      const priority = singleQuery(req.query.priority, 'Öncelik filtresi');
      const category = singleQuery(req.query.category, 'Kategori filtresi');
      const blockId = singleQuery(req.query.blockId, 'Blok filtresi');
      const search = singleQuery(req.query.search, 'Arama filtresi');
      const dateStart = singleQuery(req.query.dateStart, 'Başlangıç tarihi');
      const dateEnd = singleQuery(req.query.dateEnd, 'Bitiş tarihi');
      if (status && status !== 'ALL' && !Object.values(MaintenanceStatus).includes(status as MaintenanceStatus)) throw new AppError('Geçersiz arıza durumu filtresi.', 400);
      if (priority && priority !== 'ALL' && !Object.values(MaintenancePriority).includes(priority as MaintenancePriority)) throw new AppError('Geçersiz arıza önceliği filtresi.', 400);
      if (blockId) validateMaintenanceId(blockId, 'Blok kimliği');

      const result = await maintenanceService.getMaintenances({
        status: status ? (status as MaintenanceStatus | 'ALL') : undefined,
        priority: priority ? (priority as MaintenancePriority | 'ALL') : undefined,
        category,
        blockId,
        search: cleanString(search, 100) || undefined,
        dateStart,
        dateEnd,
        exportMaxRows: config.maintenance.exportMaxRows,
      });

      const generatedBy = req.user?.fullName || 'Lojman Yönetimi';
      const buffer = await createMaintenanceWorkbook(result.items, generatedBy);

      const dateStr = formatIstanbulDate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Ariza_Bakim_Kayitlari_${dateStr}.xlsx`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  },

  deleteMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      validateMaintenanceId(id);
      await maintenanceService.deleteMaintenance(id, req.user?.id);
      res.status(200).json({
        success: true,
        message: 'Arıza kaydı başarıyla silindi.',
      });
    } catch (error) {
      next(error);
    }
  },
};
