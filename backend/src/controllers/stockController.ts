import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { createStockWorkbook } from '../services/stockExportService';
import { StockService } from '../services/stockService';
import { formatIstanbulDate } from '../utils/dateTime';
import { StockMovementType } from '@prisma/client';
import { stockPositivePage, stockRequestBody, stockSingleQuery, validateStockId } from '../security/stockPolicy';
import { config } from '../config';
const userId = (req: Request) => (req as AuthenticatedRequest).user?.id;
const requestKey = (req: Request) => {
  const value = req.get('X-Idempotency-Key');
  return value ? validateStockId(value, 'Tekrar-gönderim anahtarı') : undefined;
};

export const stockController = {
  getOverview: async (_req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json({ success: true, data: await StockService.getOverview() }); } catch (error) { next(error); }
  },

  getMovements: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const search = stockSingleQuery(req.query.search, 'Arama filtresi');
      const stockItemId = stockSingleQuery(req.query.stockItemId, 'Stok kartı filtresi');
      const type = stockSingleQuery(req.query.type, 'Hareket türü filtresi');
      const dateStart = stockSingleQuery(req.query.dateStart, 'Başlangıç tarihi');
      const dateEnd = stockSingleQuery(req.query.dateEnd, 'Bitiş tarihi');
      if (stockItemId) validateStockId(stockItemId, 'Stok kartı filtresi');
      if (type && !Object.values(StockMovementType).includes(type as StockMovementType)) {
        return res.status(400).json({ success: false, message: 'Geçersiz stok hareket türü.' });
      }
      const data = await StockService.getMovements({
        search, stockItemId, type: type as StockMovementType | undefined, dateStart, dateEnd,
        page: stockPositivePage(req.query.page, 'Sayfa', 1),
        pageSize: Math.min(stockPositivePage(req.query.pageSize, 'Sayfa boyutu', 50), 100),
      });
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  },

  getNextItemCode: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = stockSingleQuery(req.query.category, 'Kategori');
      const code = await StockService.generateNextItemCode(category);
      res.status(200).json({ success: true, data: { itemCode: code } });
    } catch (error) { next(error); }
  },

  createStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await StockService.createStockItem({ ...stockRequestBody(req.body), createdById: userId(req), requestKey: requestKey(req) } as any);
      res.status(201).json({ success: true, data: item, message: 'Stok kartı ve açılış hareketi oluşturuldu.' });
    } catch (error) { next(error); }
  },

  updateStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateStockId(req.params.id);
      const item = await StockService.updateStockItem(req.params.id, { ...stockRequestBody(req.body), createdById: userId(req), requestKey: requestKey(req) });
      res.status(200).json({ success: true, data: item, message: 'Stok kartı güncellendi.' });
    } catch (error) { next(error); }
  },

  receive: async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateStockId(req.params.id);
      const item = await StockService.receive(req.params.id, { ...stockRequestBody(req.body), createdById: userId(req), requestKey: requestKey(req) } as any);
      res.status(200).json({ success: true, data: item, message: 'Depo girişi hareket kaydına işlendi.' });
    } catch (error) { next(error); }
  },

  reconcileCount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateStockId(req.params.id);
      const result = await StockService.reconcilePhysicalCount(req.params.id, { ...stockRequestBody(req.body), createdById: userId(req), requestKey: requestKey(req) } as any);
      res.status(200).json({ success: true, data: result, message: 'Fiziksel sayım farkı stok hareketlerine işlendi.' });
    } catch (error) { next(error); }
  },

  assignRoom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = stockRequestBody(req.body);
      validateStockId(req.params.id); validateStockId(body.roomId, 'Oda kimliği');
      const assignment = await StockService.assignToRoom(req.params.id, { ...body, createdById: userId(req), requestKey: requestKey(req) } as any);
      res.status(201).json({ success: true, data: assignment, message: 'Ürün depodan düşülerek odaya zimmetlendi.' });
    } catch (error) { next(error); }
  },

  assignRooms: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = stockRequestBody(req.body);
      validateStockId(req.params.id);
      if (!Array.isArray(body.roomIds) || body.roomIds.length === 0) return res.status(400).json({ success: false, message: 'En az bir oda seçilmelidir.' });
      const roomIds = body.roomIds.map((id: unknown) => validateStockId(id, 'Oda kimliği'));
      const result = await StockService.assignToRooms(req.params.id, { ...body, roomIds, createdById: userId(req), requestKey: requestKey(req) } as any);
      res.status(201).json({ success: true, data: result, message: `${result.roomCount} odaya toplam ${result.totalQuantity} adet zimmet oluşturuldu.` });
    } catch (error) { next(error); }
  },

  returnAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = stockRequestBody(req.body); validateStockId(req.params.inventoryId, 'Zimmet kimliği');
      if (!['RETURNED', 'RETIRED'].includes(body.outcome)) {
        return res.status(400).json({ success: false, message: 'Geçersiz iade işlemi.' });
      }
      const result = await StockService.returnFromRoom(req.params.inventoryId, { ...body, createdById: userId(req), requestKey: requestKey(req) } as any);
      res.status(200).json({ success: true, data: result, message: 'Oda zimmeti sonuçlandırıldı.' });
    } catch (error) { next(error); }
  },

  transferAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = stockRequestBody(req.body); validateStockId(req.params.inventoryId, 'Zimmet kimliği'); validateStockId(body.roomId, 'Oda kimliği');
      const result = await StockService.transferRoom(req.params.inventoryId, { ...body, createdById: userId(req), requestKey: requestKey(req) } as any);
      res.status(200).json({ success: true, data: result, message: 'Zimmet odalar arasında transfer edildi.' });
    } catch (error) { next(error); }
  },

  updateAssignmentIdentity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateStockId(req.params.inventoryId, 'Zimmet kimliği');
      const result = await StockService.updateAssignmentIdentity(req.params.inventoryId, { ...stockRequestBody(req.body), createdById: userId(req), requestKey: requestKey(req) });
      res.status(200).json({ success: true, data: result, message: 'Cihaz kimlik bilgileri hareket geçmişi korunarak güncellendi.' });
    } catch (error) { next(error); }
  },

  replaceAssignment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateStockId(req.params.inventoryId, 'Zimmet kimliği');
      const authReq = req as AuthenticatedRequest;
      const result = await StockService.replaceAssignment(req.params.inventoryId, { ...stockRequestBody(req.body), createdById: userId(req), performedBy: authReq.user?.fullName, requestKey: requestKey(req) });
      res.status(200).json({ success: true, data: result, message: 'Arızalı ürün düşülerek sağlam ürünle değiştirildi.' });
    } catch (error) { next(error); }
  },

  exportExcel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await StockService.getExportData(config.stock.exportMaxRows);
      const generatedBy = (req as AuthenticatedRequest).user?.fullName || 'Lojman Yönetimi';
      const buffer = await createStockWorkbook(rows, generatedBy);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Depo_Stok_ve_Oda_Zimmetleri_${formatIstanbulDate()}.xlsx`);
      res.status(200).send(buffer);
    } catch (error) { next(error); }
  },

  deleteStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateStockId(req.params.id);
      await StockService.deleteStockItem(req.params.id);
      res.status(200).json({ success: true, message: 'Boş stok kartı silindi.' });
    } catch (error) { next(error); }
  },
};
