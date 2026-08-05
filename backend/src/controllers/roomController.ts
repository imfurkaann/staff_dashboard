import { Request, Response, NextFunction } from 'express';
import { roomService } from '../services/roomService';
import { MaintenancePriority, MaintenanceStatus, RoomInventoryStatus, RoomStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

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

      const rooms = await roomService.getRooms(filters);
      res.status(200).json({ success: true, data: rooms });
    } catch (error) {
      next(error);
    }
  },

  getRoomById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
      const room = await roomService.getRoomById(req.params.id);
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
      const { blockId, floor, roomNumber, capacity } = req.body;

      if (!blockId || floor === undefined || !roomNumber) {
        return res.status(400).json({
          success: false,
          message: 'Blok ID, Kat ve Oda Numarası zorunludur.',
        });
      }

      const parsedFloor = Number(floor);
      const parsedCapacity = capacity === undefined ? 2 : Number(capacity);
      const normalizedRoomNumber = cleanString(roomNumber, 20).toLocaleUpperCase('tr-TR');
      if (!isUuid(blockId)) return res.status(400).json({ success: false, message: 'Geçersiz blok kimliği.' });
      if (!Number.isInteger(parsedFloor) || parsedFloor < -5 || parsedFloor > 200) return res.status(400).json({ success: false, message: 'Kat değeri -5 ile 200 arasında olmalıdır.' });
      if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 26) return res.status(400).json({ success: false, message: 'Oda kapasitesi 1 ile 26 arasında olmalıdır.' });
      if (!/^[A-Z0-9ÇĞİÖŞÜ_-]{1,20}$/u.test(normalizedRoomNumber)) return res.status(400).json({ success: false, message: 'Oda numarası yalnızca harf, rakam, tire ve alt çizgi içerebilir.' });
      const newRoom = await roomService.createRoom({
        blockId,
        floor: parsedFloor,
        roomNumber: normalizedRoomNumber,
        capacity: parsedCapacity,
      });

      res.status(201).json({ success: true, data: newRoom, message: 'Oda ve yataklar başarıyla oluşturuldu.' });
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
      const { title, description, priority = 'MEDIUM', category, location } = req.body;

      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });
      const cleanTitle = cleanString(title, 100);
      const cleanDescription = cleanString(description, 2000);
      const cleanCategory = cleanString(category, 100);
      const cleanLocation = cleanString(location, 100);
      if (!cleanTitle || !cleanDescription) {
        return res.status(400).json({
          success: false,
          message: 'Arıza başlığı ve açıklama zorunludur.',
        });
      }

      if (!Object.values(MaintenancePriority).includes(priority)) {
        return res.status(400).json({ success: false, message: 'Geçersiz arıza önceliği.' });
      }

      const maintenance = await roomService.createMaintenance({
        roomId: id,
        title: cleanTitle,
        description: cleanDescription,
        priority,
        reportedBy: req.user?.fullName || 'Lojman Yönetimi',
        category: cleanCategory || undefined,
        location: cleanLocation || undefined,
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
      const targetAssignedTo = assignedTo !== undefined
        ? (cleanString(assignedTo, 100) || null)
        : (status === 'RESOLVED' || status === 'CLOSED'
            ? userSolver
            : (status === 'OPEN' ? null : undefined));

      const updated = await roomService.updateMaintenance(maintenanceId, {
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
      const { maintenanceId } = req.params;
      if (!isUuid(maintenanceId)) return res.status(400).json({ success: false, message: 'Geçersiz arıza kaydı kimliği.' });
      await roomService.deleteMaintenance(maintenanceId);

      res.status(200).json({
        success: true,
        message: 'Arıza kaydı silindi.',
      });
    } catch (error) {
      next(error);
    }
  },
  updateInventory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { inventoryId } = req.params;
      const { status, notes } = req.body;
      if (!isUuid(inventoryId)) return res.status(400).json({ success: false, message: 'Geçersiz zimmet kaydı kimliği.' });
      if (status && !Object.values(RoomInventoryStatus).includes(status)) return res.status(400).json({ success: false, message: 'Geçersiz zimmet durumu.' });
      const updated = await roomService.updateInventory(inventoryId, {
        status,
        notes: notes === undefined ? undefined : cleanString(notes, 1000) || null,
      });
      res.status(200).json({ success: true, data: updated, message: 'Oda zimmet durumu güncellendi.' });
    } catch (error) { next(error); }
  },

  createCleaningLog: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { requestedBy, cleanedBy, notes, status } = req.body;
      if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Geçersiz oda kimliği.' });

      const authReq = req as AuthenticatedRequest;
      const userFullName = authReq.user?.fullName || 'Lojman Yönetimi';

      const finalRequestedBy = (!requestedBy || requestedBy === 'Lojman Yönetimi')
        ? userFullName
        : requestedBy;

      const finalCleanedBy = (cleanedBy === 'Lojman Yönetimi')
        ? userFullName
        : cleanedBy;

      const updatedRoom = await roomService.createCleaningLog(id, {
        requestedBy: cleanString(finalRequestedBy, 100) || undefined,
        cleanedBy: cleanString(finalCleanedBy, 100) || undefined,
        notes: cleanString(notes, 1000) || undefined,
        status: status ? cleanString(status, 30) : undefined,
      });
      res.status(201).json({ success: true, data: updatedRoom, message: 'Temizlik kaydı oluşturuldu.' });
    } catch (error) { next(error); }
  },

  updateCleaningLog: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cleaningId } = req.params;
      const { status, cleanedBy, notes, requestedBy } = req.body;
      if (!isUuid(cleaningId)) return res.status(400).json({ success: false, message: 'Geçersiz temizlik kaydı kimliği.' });

      const authReq = req as AuthenticatedRequest;
      const userFullName = authReq.user?.fullName || 'Lojman Yönetimi';

      const finalRequestedBy = (requestedBy === 'Lojman Yönetimi')
        ? userFullName
        : requestedBy;

      const finalCleanedBy = (cleanedBy === 'Lojman Yönetimi')
        ? userFullName
        : cleanedBy;

      const updatedRoom = await roomService.updateCleaningLog(cleaningId, {
        status: status ? cleanString(status, 30) : undefined,
        cleanedBy: cleanedBy !== undefined ? (cleanString(finalCleanedBy, 100) || undefined) : undefined,
        notes: notes !== undefined ? (cleanString(notes, 1000) || undefined) : undefined,
        requestedBy: requestedBy !== undefined ? (cleanString(finalRequestedBy, 100) || undefined) : undefined,
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
};
