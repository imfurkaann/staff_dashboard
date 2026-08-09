import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { normalizeUpper } from '../utils/normalization';

export class StockService {
  /** Get all stock items */
  public static async getStockItems() {
    return prisma.stockItem.findMany({
      orderBy: { itemName: 'asc' },
    });
  }

  /** Create a new stock item */
  public static async createStockItem(data: { itemName: string; totalStock: number }) {
    if (!data.itemName || !data.itemName.trim()) {
      throw new AppError('Stok kalemi adı zorunludur.', 400);
    }
    const normalizedName = normalizeUpper(data.itemName);
    if (!normalizedName) {
      throw new AppError('Stok kalemi adı zorunludur.', 400);
    }
    const total = data.totalStock !== undefined ? Math.max(0, Number(data.totalStock)) : 0;

    const existing = await prisma.stockItem.findUnique({
      where: { itemName: normalizedName },
    });
    if (existing) {
      throw new AppError('Bu isimde bir stok kalemi zaten tanımlı.', 400);
    }

    return prisma.stockItem.create({
      data: {
        itemName: normalizedName,
        totalStock: total,
        usedStock: 0,
      },
    });
  }

  /** Update stock quantity directly to a new total */
  public static async updateStockQuantity(stockItemId: string, newTotal: number) {
    const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!stockItem) throw new AppError('Stok kalemi bulunamadı.', 404);

    const parsedNewTotal = Number(newTotal);
    if (parsedNewTotal < stockItem.usedStock) {
      throw new AppError(`Toplam stok miktarı şu an kullanımda olan miktardan (${stockItem.usedStock}) az olamaz.`, 400);
    }

    return prisma.stockItem.update({
      where: { id: stockItemId },
      data: { totalStock: parsedNewTotal },
    });
  }

  /** Delete a stock item */
  public static async deleteStockItem(stockItemId: string) {
    const stockItem = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (!stockItem) throw new AppError('Stok kalemi bulunamadı.', 404);

    if (stockItem.usedStock > 0) {
      throw new AppError('Bu stok kalemi şu anda personellere zimmetli olduğu için silinemez. Önce zimmetleri iade alın.', 400);
    }

    return prisma.stockItem.delete({
      where: { id: stockItemId },
    });
  }
}
