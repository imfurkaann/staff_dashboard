import { AppError } from '../middleware/errorHandler';

export const BUSINESS_TIME_ZONE = 'Europe/Istanbul';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseIstanbulDateBoundary(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  if (!DATE_PATTERN.test(value)) throw new AppError('Tarih YYYY-AA-GG biçiminde olmalıdır.', 400);
  const suffix = endOfDay ? 'T23:59:59.999+03:00' : 'T00:00:00.000+03:00';
  const date = new Date(`${value}${suffix}`);
  if (Number.isNaN(date.getTime()) || formatIstanbulDate(date) !== value) throw new AppError('Geçersiz tarih.', 400);
  return date;
}

export function assertDateRange(start?: Date, end?: Date): void {
  if (start && end && start > end) throw new AppError('Başlangıç tarihi bitiş tarihinden sonra olamaz.', 400);
}

export function formatIstanbulDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(date);
}
