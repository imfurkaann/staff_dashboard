import { Request, Response, NextFunction } from 'express';
import { maintenanceService } from '../services/maintenanceService';
import { createMaintenanceWorkbook } from '../services/maintenanceExportService';
import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const cleanString = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const maintenanceController = {
  getMaintenances: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, priority, category, blockId, search, dateStart, dateEnd, page, pageSize } = req.query;

      if (status && status !== 'ALL' && !Object.values(MaintenanceStatus).includes(String(status) as MaintenanceStatus)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza durumu filtresi.' });
      }

      if (priority && priority !== 'ALL' && !Object.values(MaintenancePriority).includes(String(priority) as MaintenancePriority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği filtresi.' });
      }

      if (blockId && !isUuid(String(blockId))) {
        return res.status(400).json({ success: false, message: 'Geçersiz blok kimliği.' });
      }

      const parsedPage = page ? parseInt(String(page), 10) : undefined;
      const parsedPageSize = pageSize ? parseInt(String(pageSize), 10) : undefined;

      const result = await maintenanceService.getMaintenances({
        status: status ? (String(status) as MaintenanceStatus | 'ALL') : undefined,
        priority: priority ? (String(priority) as MaintenancePriority | 'ALL') : undefined,
        category: category ? String(category) : undefined,
        blockId: blockId ? String(blockId) : undefined,
        search: cleanString(search, 100) || undefined,
        dateStart: dateStart ? String(dateStart) : undefined,
        dateEnd: dateEnd ? String(dateEnd) : undefined,
        page: parsedPage && !isNaN(parsedPage) ? parsedPage : undefined,
        pageSize: parsedPageSize && !isNaN(parsedPageSize) ? parsedPageSize : undefined,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  createMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { roomId, title, description, priority = 'MEDIUM', category, location, assignedTo } = req.body;

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

      if (roomId && !isUuid(String(roomId))) {
        return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
      }

      if (!Object.values(MaintenancePriority).includes(priority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği.' });
      }

      const maintenance = await maintenanceService.createMaintenance({
        roomId: roomId ? String(roomId) : undefined,
        title: cleanTitle,
        description: cleanDescription,
        priority,
        category: cleanCategory || undefined,
        location: cleanLocation || undefined,
        reportedBy: req.user?.fullName || 'Lojman Yönetimi',
        assignedTo: cleanAssignedTo || undefined,
      });

      res.status(201).json({
        success: true,
        data: maintenance,
        message: 'Arıza kaydı başarıyla oluşturuldu.',
      });
    } catch (error) {
      next(error);
    }
  },

  updateMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, description, priority, status, assignedTo, category, location, resolutionNote } = req.body;

      if (!isUuid(id)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza kaydı kimliği.' });
      }

      if (priority && !Object.values(MaintenancePriority).includes(priority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği.' });
      }

      if (status && !Object.values(MaintenanceStatus).includes(status)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza durumu.' });
      }

      const userSolver = req.user?.fullName || 'Lojman Yönetimi';
      const targetAssignedTo = assignedTo !== undefined
        ? (cleanString(assignedTo, 100) || null)
        : ((status === 'RESOLVED' || status === 'CLOSED') ? userSolver : undefined);

      const updated = await maintenanceService.updateMaintenance(id, {
        title: title === undefined ? undefined : cleanString(title, 100),
        description: description === undefined ? undefined : cleanString(description, 2000),
        priority,
        status,
        assignedTo: targetAssignedTo,
        category: category === undefined ? undefined : cleanString(category, 100) || null,
        location: location === undefined ? undefined : cleanString(location, 100) || null,
        resolutionNote: resolutionNote === undefined ? undefined : cleanString(resolutionNote, 1000) || null,
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Arıza kaydı güncellendi.',
      });
    } catch (error) {
      next(error);
    }
  },

  deleteMaintenance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!isUuid(id)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza kaydı kimliği.' });
      }

      await maintenanceService.deleteMaintenance(id);

      res.status(200).json({
        success: true,
        message: 'Arıza kaydı silindi.',
      });
    } catch (error) {
      next(error);
    }
  },

  exportExcel: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { status, priority, category, blockId, search, dateStart, dateEnd } = req.query;

      const result = await maintenanceService.getMaintenances({
        status: status ? (String(status) as MaintenanceStatus | 'ALL') : undefined,
        priority: priority ? (String(priority) as MaintenancePriority | 'ALL') : undefined,
        category: category ? String(category) : undefined,
        blockId: blockId ? String(blockId) : undefined,
        search: cleanString(search, 100) || undefined,
        dateStart: dateStart ? String(dateStart) : undefined,
        dateEnd: dateEnd ? String(dateEnd) : undefined,
      });

      const generatedBy = req.user?.fullName || 'Lojman Yönetimi';
      const buffer = await createMaintenanceWorkbook(result.items, generatedBy);

      const dateStr = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Ariza_Bakim_Kayitlari_${dateStr}.xlsx`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  },
};
