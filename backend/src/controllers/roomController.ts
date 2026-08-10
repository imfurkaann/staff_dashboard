import { Request, Response, NextFunction } from 'express';
import { roomService } from '../services/roomService';
import { maintenanceService } from '../services/maintenanceService';
import { MaintenancePriority, MaintenanceStatus, MaintenanceType, RoomInventoryStatus, RoomStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { formatIstanbulDate } from '../utils/dateTime';
import { createOccupancyWorkbook, createRoomInventoryWorkbook } from '../services/roomExportService';
import { scopeRoomData } from '../security/dataScope';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const cleanString = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const roomController = {
  getRooms: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { blockId, floor, status, search } = req.query;

      const parsedFloor = floor !== undefined && floor !== '' ? Number(floor) : undefined;
      if (parsedFloor !== undefined && (!Number.isInteger(parsedFloor) || parsedFloor < -5 || parsedFloor > 200)) {
        return res.status(400).json({ success: false, message: 'Kat değeri geçersiz.' });
      }
      if (status && !Object.values(RoomStatus).includes(String(status) as RoomStatus)) {
        return res.status(400).json({ success: false, message: 'Oda durumu filtresi geçersiz.' });
      }
      const cleanSearch = cleanString(search, 100);
      if (blockId && !isUuid(String(blockId))) return res.status(400).json({ success: false, message: 'Blok filtresi geçersiz.' });
      const filters = {
        blockId: blockId ? String(blockId) : undefined,
        floor: parsedFloor,
        status: status ? (String(status) as RoomStatus) : undefined,
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

      const parsedFloor = Number(floor);
      const normalizedRoomType = roomType ? cleanString(roomType, 50).toLocaleUpperCase('tr-TR') : 'PERSONEL_ODASI';
      const parsedCapacity = normalizedRoomType === 'PERSONEL_ODASI' ? (capacity === undefined ? 2 : Number(capacity)) : 0;
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
      const { type = 'GENERAL', roomInventoryId, inventoryStatus, title, description, priority = 'MEDIUM', category, location } = req.body;

      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
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
        data: maintenance,
        message: 'Arıza kaydı başarıyla oluşturuldu ve teknik ekibe yönlendirildi.',
      });
    } catch (error) {
      next(error);
    }
  },

  updateMaintenance: async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { maintenanceId } = req.params;
      const { title, description, priority, status, assignedTo, category, location, resolutionNote } = req.body;
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
      const updatedRoom = await roomService.deleteCleaningLog(cleaningId);
      res.status(200).json({ success: true, data: updatedRoom, message: 'Temizlik kaydı silindi.' });
    } catch (error) { next(error); }
  },

  exportOccupancyExcel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = req.query.filter as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const authReq = req as AuthenticatedRequest;
      const generatedBy = authReq.user?.fullName || 'Lojman Yönetimi';

      const rows = await roomService.getExportOccupancies(filter, startDate, endDate);
      const buffer = await createOccupancyWorkbook(rows, generatedBy);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Konaklayanlar_Listesi_${formatIstanbulDate()}.xlsx`);
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  },

  exportRoomInventoryExcel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filter = req.query.filter as string;
      const authReq = req as AuthenticatedRequest;
      const generatedBy = authReq.user?.fullName || 'Lojman Yönetimi';

      const rows = await roomService.getExportRoomInventories(filter);
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

      const updatedRoom = await roomService.updateRoom(id, {
        roomNumber: roomNumber !== undefined ? cleanString(roomNumber, 50) : undefined,
        floor: floor !== undefined ? Number(floor) : undefined,
        capacity: capacity !== undefined ? Number(capacity) : undefined,
        roomType: roomType !== undefined ? cleanString(roomType, 50) : undefined,
        status: status ? (status as RoomStatus) : undefined,
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
      const { itemName, stockItemId } = req.body;
      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });

      if (!itemName || !cleanString(itemName, 100)) {
        return res.status(400).json({ success: false, message: 'Demirbaş eşya adı zorunludur.' });
      }

      const newInventory = await roomService.createRoomInventory(id, {
        itemName: cleanString(itemName, 100),
        quantity: 1,
        status: 'HEALTHY',
        stockItemId: cleanString(stockItemId, 100),
        createdById: (req as AuthenticatedRequest).user?.id,
      });

      res.status(201).json({ success: true, data: newInventory, message: 'Yeni demirbaş eşya odaya eklendi.' });
    } catch (error) {
      next(error);
    }
  },

};
