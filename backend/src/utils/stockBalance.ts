import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export async function reserveRoomStock(tx: Prisma.TransactionClient, stockItemId: string, quantity: number): Promise<void> {
  const changed = await tx.$executeRaw`
    UPDATE "StockItem"
    SET "usedInRooms" = "usedInRooms" + ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${stockItemId}
      AND "isActive" = true
      AND "totalStock" - "usedStock" - "usedInRooms" >= ${quantity}
  `;
  if (changed !== 1) throw new AppError('İşlem sırasında müsait stok değişti. Güncel stok yetersiz.', 409);
}

export async function reservePersonnelStock(tx: Prisma.TransactionClient, stockItemId: string): Promise<void> {
  const changed = await tx.$executeRaw`
    UPDATE "StockItem"
    SET "usedStock" = "usedStock" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${stockItemId}
      AND "isActive" = true
      AND "totalStock" - "usedStock" - "usedInRooms" >= 1
  `;
  if (changed !== 1) throw new AppError('İşlem sırasında müsait stok değişti. Güncel stok yetersiz.', 409);
}

export async function releaseRoomStock(tx: Prisma.TransactionClient, stockItemId: string, quantity: number, retire = false): Promise<void> {
  const changed = await tx.stockItem.updateMany({
    where: { id: stockItemId, usedInRooms: { gte: quantity }, ...(retire ? { totalStock: { gte: quantity } } : {}) },
    data: {
      usedInRooms: { decrement: quantity },
      ...(retire ? { totalStock: { decrement: quantity } } : {}),
    },
  });
  if (changed.count !== 1) throw new AppError('Stok bakiyesi ile oda zimmeti uyuşmuyor. İşlem durduruldu.', 409);
}

export async function releasePersonnelStock(tx: Prisma.TransactionClient, stockItemId: string, retire = false): Promise<void> {
  const changed = await tx.stockItem.updateMany({
    where: { id: stockItemId, usedStock: { gte: 1 }, ...(retire ? { totalStock: { gte: 1 } } : {}) },
    data: {
      usedStock: { decrement: 1 },
      ...(retire ? { totalStock: { decrement: 1 } } : {}),
    },
  });
  if (changed.count !== 1) throw new AppError('Stok bakiyesi ile personel zimmeti uyuşmuyor. İşlem durduruldu.', 409);
}
