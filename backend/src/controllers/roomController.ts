import { Request, Response, NextFunction } from 'express';
import { roomService } from '../services/roomService';
import { maintenanceService } from '../services/maintenanceService';
import { MaintenancePriority, MaintenanceStatus, MaintenanceType, RoomInventoryStatus, RoomStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { formatIstanbulDate } from '../utils/dateTime';
import { createOccupancyWorkbook, createRoomInventoryWorkbook } from '../services/roomExportService';
import { scopeMaintenanceData, scopeRoomData } from '../security/dataScope';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { hasPermission, permissions } from '../security/permissions';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
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
const singleQuery = (value: unknown, fieldName: string): string | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new AppError(`${fieldName} tek bir metin değeri olmalıdır.`, 400);
  return value;
};
const strictInteger = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new AppError(`${fieldName} tam sayı olmalıdır.`, 400);
  return value;
};

export const roomController = {
  getRooms: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blockId = singleQuery(req.query.blockId, 'Blok filtresi');
      const floor = singleQuery(req.query.floor, 'Kat filtresi');
      const status = singleQuery(req.query.status, 'Durum filtresi');
      const search = singleQuery(req.query.search, 'Arama filtresi');

      const parsedFloor = floor !== undefined && floor !== '' ? Number(floor) : undefined;
      if (parsedFloor !== undefined && (!Number.isInteger(parsedFloor) || parsedFloor < -5 || parsedFloor > 200)) {
        return res.status(400).json({ success: false, message: 'Kat değeri geçersiz.' });
      }
      if (status && !Object.values(RoomStatus).includes(status as RoomStatus)) {
        return res.status(400).json({ success: false, message: 'Oda durumu filtresi geçersiz.' });
      }
      const cleanSearch = cleanString(search, 100);
      if (blockId && !isUuid(blockId)) return res.status(400).json({ success: false, message: 'Blok filtresi geçersiz.' });
      const filters = {
        blockId,
        floor: parsedFloor,
        status: status ? (status as RoomStatus) : undefined,
        search: cleanSearch || undefined,
      };

      const role = (req as AuthenticatedRequest).user?.role;
      const rooms = scopeRoomData(await roomService.getRooms(filters), role);
      res.status(200).json({ success: true, data: rooms });
    } catch (error) {
      next(error);
    }
  },

  getRoomById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
      const room = scopeRoomData(await roomService.getRoomById(req.params.id), (req as AuthenticatedRequest).user?.role);
      res.status(200).json({ success: true, data: room });
    } catch (error) { next(error); }
  },

  getBlocks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const blocks = await roomService.getBlocks();
      res.status(200).json({ success: true, data: blocks });
    } catch (error) {
      next(error);
    }
  },

  getStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await roomService.getRoomStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
      if (!status || !Object.values(RoomStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Geçersiz oda durumu. Geçerli değerler: READY, NEEDS_CLEANING, OUT_OF_ORDER',
        });
      }
      const actorRole = (req as AuthenticatedRequest).user?.role;
      if (actorRole === 'HOUSEKEEPING' && !['READY', 'NEEDS_CLEANING'].includes(status)) {
        return res.status(403).json({ success: false, message: 'Kat hizmetleri yalnızca temiz/hazır ve temizlik gerekli durumlarını değiştirebilir.' });
      }

      const authReq = req as AuthenticatedRequest;
      const userFullName = authReq.user?.fullName || 'Lojman Yönetimi';

      const updatedRoom = await roomService.updateRoomStatus(id, status as RoomStatus, userFullName);
      res.status(200).json({ success: true, data: updatedRoom, message: 'Oda durumu güncellendi.' });
    } catch (error) {
      next(error);
    }
  },

  createRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { blockId, floor, roomNumber, capacity, roomType } = req.body;

      if (!blockId || floor === undefined || !roomNumber) {
        return res.status(400).json({
          success: false,
          message: 'Blok ID, Kat ve Oda Numarası/Adı zorunludur.',
        });
      }

      const parsedFloor = strictInteger(floor, 'Kat');
      const normalizedRoomType = roomType ? cleanString(roomType, 50).toLocaleUpperCase('tr-TR') : 'PERSONEL_ODASI';
      const parsedCapacity = normalizedRoomType === 'PERSONEL_ODASI' ? (capacity === undefined ? 2 : strictInteger(capacity, 'Kapasite')) : 0;
      const normalizedRoomNumber = cleanString(roomNumber, 50).toLocaleUpperCase('tr-TR');
      if (!isUuid(blockId)) return res.status(400).json({ success: false, message: 'Geçersiz blok kimliği.' });
      if (!Number.isInteger(parsedFloor) || parsedFloor < -5 || parsedFloor > 200) return res.status(400).json({ success: false, message: 'Kat değeri -5 ile 200 arasında olmalıdır.' });
      if (!Number.isInteger(parsedCapacity) || parsedCapacity < 0 || parsedCapacity > 26) return res.status(400).json({ success: false, message: 'Oda kapasitesi 0 ile 26 arasında olmalıdır.' });
      const newRoom = await roomService.createRoom({
        blockId,
        floor: parsedFloor,
        roomNumber: normalizedRoomNumber,
        capacity: parsedCapacity,
        roomType: normalizedRoomType,
      });

      res.status(201).json({ success: true, data: newRoom, message: 'Oda kaydı başarıyla oluşturuldu.' });
    } catch (error) {
      next(error);
    }
  },

  createBlock: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, genderPolicy } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Blok adı zorunludur.',
        });
      }

      const cleanName = cleanString(name, 50);
      const cleanPolicy = cleanString(genderPolicy || 'Mixed', 10);
      if (!['Male', 'Female', 'Mixed'].includes(cleanPolicy)) return res.status(400).json({ success: false, message: 'Blok cinsiyet politikası geçersiz.' });
      const newBlock = await roomService.createBlock({
        name: cleanName,
        genderPolicy: cleanPolicy,
      });

      res.status(201).json({ success: true, data: newBlock, message: 'Yeni blok oluşturuldu.' });
    } catch (error) {
      next(error);
    }
  },

  createMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const requestKey = req.get('X-Idempotency-Key');
      const { type = 'GENERAL', roomInventoryId, inventoryStatus, title, description, priority = 'MEDIUM', category, location } = requestBody(req.body);

      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
      if (requestKey && !isUuid(requestKey)) return res.status(400).json({ success: false, message: 'Geçersiz tekrar-gönderim anahtarı.' });
      const cleanTitle = cleanString(title, 100);
      const cleanDescription = cleanString(description, 2000);
      const cleanCategory = cleanString(category, 100);
      const cleanLocation = cleanString(location, 100);
      if (!cleanDescription || (type === 'GENERAL' && !cleanTitle)) {
        return res.status(400).json({
          success: false,
          message: 'Arıza başlığı ve açıklama zorunludur.',
        });
      }

      if (!Object.values(MaintenancePriority).includes(priority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği.' });
      }
      if (!Object.values(MaintenanceType).includes(type)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza kayıt türü.' });
      }
      if (roomInventoryId && !isUuid(String(roomInventoryId))) {
        return res.status(400).json({ success: false, message: 'Geçersiz oda demirbaşı kimliği.' });
      }
      if (inventoryStatus && !Object.values(RoomInventoryStatus).includes(inventoryStatus)) {
        return res.status(400).json({ success: false, message: 'Geçersiz demirbaş durumu.' });
      }
      if (inventoryStatus === 'LOST' && !['ADMIN', 'HOUSING_MANAGER'].includes(req.user?.role || '')) {
        return res.status(403).json({ success: false, message: 'Kayıp / zayi stok düşümü yalnızca yetkili yönetici tarafından onaylanabilir.' });
      }

      const maintenance = await maintenanceService.createMaintenance({
        requestKey,
        roomId: id,
        type,
        roomInventoryId: roomInventoryId ? String(roomInventoryId) : undefined,
        inventoryStatus,
        title: cleanTitle,
        description: cleanDescription,
        priority,
        reportedBy: req.user?.fullName || 'Lojman Yönetimi',
        category: cleanCategory || undefined,
        location: cleanLocation || undefined,
        createdById: req.user?.id,
      });

      res.status(201).json({
        success: true,
        data: scopeMaintenanceData(maintenance, req.user?.role),
        message: 'Arıza kaydı başarıyla oluşturuldu ve teknik ekibe yönlendirildi.',
      });
    } catch (error) {
      next(error);
    }
  },

  updateMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { maintenanceId } = req.params;
      const { title, description, priority, status, assignedTo, category, location, resolutionNote } = requestBody(req.body);
      if (!isUuid(maintenanceId)) return res.status(400).json({ success: false, message: 'Geçersiz arıza kaydı kimliği.' });

      if (priority && !Object.values(MaintenancePriority).includes(priority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği.' });
      }
      if (status && !Object.values(MaintenanceStatus).includes(status)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza durumu.' });
      }

      const userSolver = req.user?.fullName || 'Lojman Yönetimi';
      const isClosing = status === 'RESOLVED' || status === 'CLOSED';
      const cleanedAssignedTo = cleanString(assignedTo, 100);
      const targetAssignedTo = assignedTo !== undefined
        ? (cleanedAssignedTo || (isClosing ? userSolver : null))
        : (isClosing
            ? userSolver
            : (status === 'OPEN' ? null : undefined));

      const updated = await maintenanceService.updateMaintenance(maintenanceId, {
        title: title === undefined ? undefined : cleanString(title, 100),
        description: description === undefined ? undefined : cleanString(description, 2000),
        priority,
        status,
        assignedTo: targetAssignedTo,
        category: category === undefined ? undefined : cleanString(category, 100) || null,
        location: location === undefined ? undefined : cleanString(location, 100) || null,
        resolutionNote: resolutionNote === undefined ? undefined : cleanString(resolutionNote, 1000) || null,
        performedBy: (req as AuthenticatedRequest).user?.fullName || 'Lojman Yönetimi',
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

  createCleaningLog: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { notes, status } = req.body;
      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });

      const authReq = req as AuthenticatedRequest;
      const userFullName = authReq.user?.fullName || 'Lojman Yönetimi';

      const updatedRoom = await roomService.createCleaningLog(id, {
        requestedBy: userFullName,
        cleanedBy: status === 'CLEANED' ? userFullName : undefined,
        notes: cleanString(notes, 1000) || undefined,
        status: status ? cleanString(status, 30) : undefined,
      });
      res.status(201).json({ success: true, data: updatedRoom, message: 'Temizlik kaydı oluşturuldu.' });
    } catch (error) { next(error); }
  },

  updateCleaningLog: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cleaningId } = req.params;
      const { status, notes } = req.body;
      if (!isUuid(cleaningId)) return res.status(400).json({ success: false, message: 'Geçersiz temizlik kaydı kimliği.' });

      const authReq = req as AuthenticatedRequest;
      const userFullName = authReq.user?.fullName || 'Lojman Yönetimi';

      const updatedRoom = await roomService.updateCleaningLog(cleaningId, {
        status: status ? cleanString(status, 30) : undefined,
        cleanedBy: status === 'CLEANED' ? userFullName : undefined,
        notes: notes !== undefined ? (cleanString(notes, 1000) || undefined) : undefined,
      });
      res.status(200).json({ success: true, data: updatedRoom, message: 'Temizlik kaydı güncellendi.' });
    } catch (error) { next(error); }
  },

  deleteCleaningLog: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cleaningId } = req.params;
      if (!isUuid(cleaningId)) return res.status(400).json({ success: false, message: 'Geçersiz temizlik kaydı kimliği.' });
      const updatedRoom = await roomService.deleteCleaningLog(cleaningId, (req as AuthenticatedRequest).user?.id);
      res.status(200).json({ success: true, data: updatedRoom, message: 'Tamamlanmış temizlik kaydı arşivlendi.' });
    } catch (error) { next(error); }
  },

  exportOccupancyExcel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = singleQuery(req.query.filter, 'Rapor filtresi');
      const startDate = singleQuery(req.query.startDate, 'Başlangıç tarihi');
      const endDate = singleQuery(req.query.endDate, 'Bitiş tarihi');
      const authReq = req as AuthenticatedRequest;
      const generatedBy = authReq.user?.fullName || 'Lojman Yönetimi';

      const rows = await roomService.getExportOccupancies(filter, startDate, endDate, config.room.occupancyExportMaxRows);
      const maySeeSensitive = hasPermission(authReq.user?.role, permissions.EMPLOYEE_SENSITIVE_VIEW);
      const exportRows = maySeeSensitive ? rows : rows.map((row) => ({ ...row, employee: row.employee ? { ...row.employee, tcNo: null } : null }));
      const buffer = await createOccupancyWorkbook(exportRows, generatedBy);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Konaklayanlar_Listesi_${formatIstanbulDate()}.xlsx`);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  },

  exportRoomInventoryExcel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = singleQuery(req.query.filter, 'Rapor filtresi');
      const authReq = req as AuthenticatedRequest;
      const generatedBy = authReq.user?.fullName || 'Lojman Yönetimi';

      const rows = await roomService.getExportRoomInventories(filter, config.room.inventoryExportMaxRows);
      const buffer = await createRoomInventoryWorkbook(rows, generatedBy);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Oda_Demirbas_Zimmetleri_${formatIstanbulDate()}.xlsx`);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  },

  updateRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { roomNumber, floor, capacity, roomType, status } = req.body;
      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
      if (status !== undefined) throw new AppError('Oda durumu yalnızca oda durum işlemi üzerinden değiştirilebilir.', 400);

      const updatedRoom = await roomService.updateRoom(id, {
        roomNumber: roomNumber !== undefined ? cleanString(roomNumber, 50) : undefined,
        floor: floor !== undefined ? strictInteger(floor, 'Kat') : undefined,
        capacity: capacity !== undefined ? strictInteger(capacity, 'Kapasite') : undefined,
        roomType: roomType !== undefined ? cleanString(roomType, 50) : undefined,
      });

      res.status(200).json({ success: true, data: updatedRoom, message: 'Oda bilgileri güncellendi.' });
    } catch (error) {
      next(error);
    }
  },

  deleteRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });

      const result = await roomService.deleteRoom(id);
      res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  },

  createRoomInventory: async (req: Request, res: Response, next: NextFunction) => {
    try {
       const { id } = req.params;
      const { itemName, stockItemId, brand, serialNo, quantity, status } = req.body;
      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });

      if (!isUuid(stockItemId)) return res.status(400).json({ success: false, message: 'Geçerli bir depo stok kartı seçilmelidir.' });
      if (status !== undefined && !Object.values(RoomInventoryStatus).includes(status)) return res.status(400).json({ success: false, message: 'Geçersiz demirbaş durumu.' });
      const parsedQuantity = quantity === undefined ? 1 : quantity;
      if (typeof parsedQuantity !== 'number' || !Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 10000) return res.status(400).json({ success: false, message: 'Zimmet miktarı 1 ile 10.000 arasında tam sayı olmalıdır.' });

      const newInventory = await roomService.createRoomInventory(id, {
        itemName: cleanString(itemName, 100) || 'STOK KARTI',
        brand: cleanString(brand, 100) || undefined,
        serialNo: cleanString(serialNo, 120) || undefined,
        quantity: parsedQuantity,
        status: status || 'HEALTHY',
        stockItemId,
        createdById: (req as AuthenticatedRequest).user?.id,
      });

      res.status(201).json({ success: true, data: newInventory, message: 'Yeni demirbaş eşya odaya eklendi.' });
    } catch (error) {
      next(error);
    }
  },

};
