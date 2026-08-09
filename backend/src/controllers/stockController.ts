import { Request, Response, NextFunction } from 'express';
import { StockService } from '../services/stockService';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const cleanString = (value: unknown, maxLength: number) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const stockController = {
  getStockItems: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await StockService.getStockItems();
      res.status(200).json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  },

  createStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemName, totalStock } = req.body;
      const cleanedName = cleanString(itemName, 120);
      if (!cleanedName) {
        return res.status(400).json({ success: false, message: 'Stok kalemi adı zorunludur.' });
      }

      const item = await StockService.createStockItem({
        itemName: cleanedName,
        totalStock: totalStock !== undefined ? Number(totalStock) : 0,
      });

      res.status(201).json({ success: true, data: item, message: 'Yeni stok kalemi başarıyla tanımlandı.' });
    } catch (error) {
      next(error);
    }
  },

  updateStockQuantity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { newTotal } = req.body;
      if (!isUuid(id)) {
        return res.status(400).json({ success: false, message: 'Geçersiz stok kalemi kimliği.' });
      }

      const parsedNewTotal = Number(newTotal);
      if (isNaN(parsedNewTotal) || parsedNewTotal < 0) {
        return res.status(400).json({ success: false, message: 'Geçersiz stok miktarı değeri.' });
      }

      const updated = await StockService.updateStockQuantity(id, parsedNewTotal);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  deleteStockItem: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        return res.status(400).json({ success: false, message: 'Geçersiz stok kalemi kimliği.' });
      }

      await StockService.deleteStockItem(id);
      res.status(200).json({ success: true, message: 'Stok kalemi silindi.' });
    } catch (error) {
      next(error);
    }
  },
};
