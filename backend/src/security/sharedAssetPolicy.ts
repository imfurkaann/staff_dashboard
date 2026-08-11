import { SharedAssetStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const sharedAssetHolderTypes = ['EMPLOYEE', 'ROOM', 'OTHER'] as const;
export const sharedAssetActions = ['MAINTENANCE_START', 'MAINTENANCE_END', 'FAULT_REPORTED', 'REPAIR_COMPLETED'] as const;

export function sharedAssetId(value: unknown, label = 'Ortak eşya kimliği'): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError(`${label} geçersiz.`, 400);
  return value;
}

export function sharedAssetBody(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('İstek gövdesi geçersiz.', 400);
  return value as Record<string, any>;
}

export function sharedAssetQuery(value: unknown, label: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new AppError(`${label} tek bir değer olmalıdır.`, 400);
  return value;
}

export function sharedAssetPage(value: unknown, label: string, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(`${label} pozitif tam sayı olmalıdır.`, 400);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new AppError(`${label} pozitif tam sayı olmalıdır.`, 400);
  return parsed;
}

export function sharedAssetStatus(value: unknown): SharedAssetStatus {
  if (typeof value !== 'string' || !Object.values(SharedAssetStatus).includes(value as SharedAssetStatus)) {
    throw new AppError('Geçersiz ortak eşya durumu.', 400);
  }
  return value as SharedAssetStatus;
}

export function sharedAssetRequestKey(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return sharedAssetId(value, 'Tekrar-gönderim anahtarı');
}
