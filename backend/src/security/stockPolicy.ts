import { AppError } from '../middleware/errorHandler';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateStockId(value: unknown, label = 'Stok kaydı kimliği'): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError(`${label} geçersiz.`, 400);
  return value;
}

export function stockRequestBody(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError('İstek gövdesi geçersiz.', 400);
  return value as Record<string, any>;
}

export function stockSingleQuery(value: unknown, label: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new AppError(`${label} tek bir değer olmalıdır.`, 400);
  return value;
}

export function stockPositivePage(value: unknown, label: string, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new AppError(`${label} pozitif tam sayı olmalıdır.`, 400);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new AppError(`${label} pozitif tam sayı olmalıdır.`, 400);
  return parsed;
}
