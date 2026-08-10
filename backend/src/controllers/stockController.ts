import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { createStockWorkbook } from '../services/stockExportService';
import { StockService } from '../services/stockService';
import { formatIstanbulDate } from '../utils/dateTime';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requireUuid = (value: unknown) => typeof value === 'string' && uuidPattern.test(value);
const userId = (req: Request) => (req as AuthenticatedRequest).user?.id;

export const stockController = {
  getOverview: async (_req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json({ success: true, data: await StockService.getOverview() }); } catch (error) { next(error); }
  },

  getNextItemCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.query.category as string | undefined;
      const code = await StockService.generateNextItemCode(category);
      res.status(200).json({ success: true, data: { itemCode: code } });
    } catch (error) { next(error); }
  },

  createStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await StockService.createStockItem({ ...req.body, createdById: userId(req) });
      res.status(201).json({ success: true, data: item, message: 'Stok kartı ve açılış hareketi oluşturuldu.' });
    } catch (error) { next(error); }
  },

  updateStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz stok kartı kimliği.' });
      const item = await StockService.updateStockItem(req.params.id, req.body);
      res.status(200).json({ success: true, data: item, message: 'Stok kartı güncellendi.' });
    } catch (error) { next(error); }
  },

  receive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz stok kartı kimliği.' });
      const item = await StockService.receive(req.params.id, { ...req.body, createdById: userId(req) });
      res.status(200).json({ success: true, data: item, message: 'Depo girişi hareket kaydına işlendi.' });
    } catch (error) { next(error); }
  },

  reconcileCount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz stok kartı kimliği.' });
      const result = await StockService.reconcilePhysicalCount(req.params.id, { ...req.body, createdById: userId(req) });
      res.status(200).json({ success: true, data: result, message: 'Fiziksel sayım farkı stok hareketlerine işlendi.' });
    } catch (error) { next(error); }
  },

  assignRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.id) || !requireUuid(req.body.roomId)) return res.status(400).json({ success: false, message: 'Geçersiz stok veya oda kimliği.' });
      const assignment = await StockService.assignToRoom(req.params.id, { ...req.body, createdById: userId(req) });
      res.status(201).json({ success: true, data: assignment, message: 'Ürün depodan düşülerek odaya zimmetlendi.' });
    } catch (error) { next(error); }
  },

  assignRooms: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roomIds = Array.isArray(req.body.roomIds) ? req.body.roomIds : [];
      if (!requireUuid(req.params.id) || roomIds.some((id: unknown) => !requireUuid(id))) {
        return res.status(400).json({ success: false, message: 'Geçersiz stok veya oda kimliği.' });
      }
      const result = await StockService.assignToRooms(req.params.id, { ...req.body, roomIds, createdById: userId(req) });
      res.status(201).json({ success: true, data: result, message: `${result.roomCount} odaya toplam ${result.totalQuantity} adet zimmet oluşturuldu.` });
    } catch (error) { next(error); }
  },

  returnAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.inventoryId) || !['RETURNED', 'RETIRED'].includes(req.body.outcome)) {
        return res.status(400).json({ success: false, message: 'Geçersiz iade işlemi.' });
      }
      const result = await StockService.returnFromRoom(req.params.inventoryId, { ...req.body, createdById: userId(req) });
      res.status(200).json({ success: true, data: result, message: 'Oda zimmeti sonuçlandırıldı.' });
    } catch (error) { next(error); }
  },

  transferAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.inventoryId) || !requireUuid(req.body.roomId)) return res.status(400).json({ success: false, message: 'Geçersiz zimmet veya oda kimliği.' });
      const result = await StockService.transferRoom(req.params.inventoryId, { ...req.body, createdById: userId(req) });
      res.status(200).json({ success: true, data: result, message: 'Zimmet odalar arasında transfer edildi.' });
    } catch (error) { next(error); }
  },

  updateAssignmentIdentity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.inventoryId)) return res.status(400).json({ success: false, message: 'Geçersiz zimmet kimliği.' });
      const result = await StockService.updateAssignmentIdentity(req.params.inventoryId, { ...req.body, createdById: userId(req) });
      res.status(200).json({ success: true, data: result, message: 'Cihaz kimlik bilgileri hareket geçmişi korunarak güncellendi.' });
    } catch (error) { next(error); }
  },

  replaceAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.inventoryId)) return res.status(400).json({ success: false, message: 'Geçersiz zimmet kimliği.' });
      const authReq = req as AuthenticatedRequest;
      const result = await StockService.replaceAssignment(req.params.inventoryId, { ...req.body, createdById: userId(req), performedBy: authReq.user?.fullName });
      res.status(200).json({ success: true, data: result, message: 'Arızalı ürün düşülerek sağlam ürünle değiştirildi.' });
    } catch (error) { next(error); }
  },

  exportExcel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await StockService.getExportData();
      const generatedBy = (req as AuthenticatedRequest).user?.fullName || 'Lojman Yönetimi';
      const buffer = await createStockWorkbook(rows, generatedBy);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Depo_Stok_ve_Oda_Zimmetleri_${formatIstanbulDate()}.xlsx`);
      res.status(200).send(buffer);
    } catch (error) { next(error); }
  },

  deleteStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!requireUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Geçersiz stok kartı kimliği.' });
      await StockService.deleteStockItem(req.params.id);
      res.status(200).json({ success: true, message: 'Boş stok kartı silindi.' });
    } catch (error) { next(error); }
  },
};
