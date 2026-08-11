import { RoomInventoryStatus, RoomStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export const ROOM_TYPES = new Set([
  'PERSONEL_ODASI', 'ÇAMAŞIRHANE', 'DEPO', 'DUŞHANE', 'MESCİT', 'TEKNİK_ODA',
  'MUTFAK', 'LOBİ', 'SPOR_SALONU', 'GÜVENLİK', 'DİĞER',
]);

export const CLEANING_STATUSES = new Set(['NEEDS_CLEANING', 'IN_PROGRESS', 'CLEANED']);
export const OCCUPANCY_EXPORT_FILTERS = new Set(['ALL', 'ACTIVE', 'CHECKED_OUT']);
export const INVENTORY_EXPORT_FILTERS = new Set([
  'ALL', 'PROBLEMATIC_ALL', 'NEEDS_ATTENTION', 'DAMAGED_LOST', ...Object.values(RoomInventoryStatus),
]);

export function normalizeRoomType(value: unknown): string {
  if (typeof value !== 'string') throw new AppError('Oda türü metin olmalıdır.', 400);
  const normalized = value.trim().toLocaleUpperCase('tr-TR');
  if (!ROOM_TYPES.has(normalized)) throw new AppError('Geçersiz oda türü.', 400);
  return normalized;
}

export function validateRoomCapacity(value: unknown, roomType: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new AppError('Oda kapasitesi tam sayı olmalıdır.', 400);
  if (roomType === 'PERSONEL_ODASI' && (value < 1 || value > 26)) throw new AppError('Konaklama odası kapasitesi 1 ile 26 arasında olmalıdır.', 400);
  if (roomType !== 'PERSONEL_ODASI' && value !== 0) throw new AppError('Hizmet alanlarının yatak kapasitesi 0 olmalıdır.', 400);
  return value;
}

export function validateRoomFloor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -5 || value > 200) throw new AppError('Kat değeri -5 ile 200 arasında tam sayı olmalıdır.', 400);
  return value;
}

export function validateRoomStatus(value: unknown): RoomStatus {
  if (typeof value !== 'string' || !Object.values(RoomStatus).includes(value as RoomStatus)) throw new AppError('Geçersiz oda durumu.', 400);
  return value as RoomStatus;
}

export function validateCleaningStatus(value: unknown, fallback = 'NEEDS_CLEANING'): string {
  const status = value === undefined ? fallback : value;
  if (typeof status !== 'string' || !CLEANING_STATUSES.has(status)) throw new AppError('Geçersiz temizlik durumu.', 400);
  return status;
}

export function validateOccupancyExportFilter(value: unknown): string {
  const filter = value === undefined || value === '' ? 'ALL' : value;
  if (typeof filter !== 'string' || !OCCUPANCY_EXPORT_FILTERS.has(filter)) throw new AppError('Geçersiz konaklama raporu filtresi.', 400);
  return filter;
}

export function validateInventoryExportFilter(value: unknown): string {
  const filter = value === undefined || value === '' ? 'ALL' : value;
  if (typeof filter !== 'string' || !INVENTORY_EXPORT_FILTERS.has(filter)) throw new AppError('Geçersiz oda demirbaşı raporu filtresi.', 400);
  return filter;
}
