import { NotificationPriority, NotificationTargetType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { assertDateRange, parseIstanbulDateBoundary } from '../utils/dateTime';
import { boundedText } from '../utils/normalization';

const priorities = new Set<string>(Object.values(NotificationPriority));
const targetTypes = new Set<string>(Object.values(NotificationTargetType));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function singleQueryValue(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new AppError(`${label} tek bir değer olmalıdır.`, 400);
  return value;
}

function parsePositiveInteger(value: unknown, label: string, fallback: number, max: number): number {
  const raw = singleQueryValue(value, label);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new AppError(`${label} pozitif tam sayı olmalıdır.`, 400);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new AppError(`${label} 1-${max} arasında olmalıdır.`, 400);
  }
  return parsed;
}

function parseTargetList(value: unknown, targetType: NotificationTargetType): string[] {
  if (typeof value !== 'string' || !value.trim()) throw new AppError('Lütfen en az bir hedef seçiniz.', 400);
  if (value.length > 50_000) throw new AppError('Hedef listesi izin verilen boyutu aşıyor.', 400);

  let parsed: unknown;
  try {
    parsed = /^[\[{]/.test(value.trim()) ? JSON.parse(value) : value.split(',');
  } catch {
    throw new AppError('Hedef listesi geçerli JSON veya virgülle ayrılmış metin olmalıdır.', 400);
  }
  if (!Array.isArray(parsed)) throw new AppError('Hedef listesi bir dizi olmalıdır.', 400);

  const maxItems = targetType === NotificationTargetType.SPECIFIC_USERS ? 1000 : 100;
  if (parsed.length === 0 || parsed.length > maxItems) {
    throw new AppError(`En fazla ${maxItems} hedef seçilebilir.`, 400);
  }
  const items = parsed.map((item) => {
    if (typeof item !== 'string') throw new AppError('Hedef listesindeki tüm değerler metin olmalıdır.', 400);
    const normalized = item.trim();
    if (!normalized || normalized.length > 120) throw new AppError('Hedef değeri geçersiz veya çok uzun.', 400);
    if (targetType === NotificationTargetType.SPECIFIC_USERS && !UUID_PATTERN.test(normalized)) {
      throw new AppError('Özel kullanıcı listesinde geçersiz kullanıcı kimliği var.', 400);
    }
    return normalized;
  });
  return Array.from(new Set(items));
}

export function validateNotificationSendInput(input: unknown): {
  title: string;
  message: string;
  priority: NotificationPriority;
  targetType: NotificationTargetType;
  targetValues: string[];
  targetValue: string | null;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Duyuru bilgileri geçersiz.', 400);
  const value = input as Record<string, unknown>;
  const priority = value.priority === undefined ? NotificationPriority.NORMAL : value.priority;
  if (typeof priority !== 'string' || !priorities.has(priority)) throw new AppError('Geçersiz bildirim önceliği.', 400);
  if (typeof value.targetType !== 'string' || !targetTypes.has(value.targetType)) throw new AppError('Geçersiz hedef kitle türü.', 400);
  const targetType = value.targetType as NotificationTargetType;

  let targetValues: string[] = [];
  let targetValue: string | null = null;
  if (targetType === NotificationTargetType.GENDER) {
    if (value.targetValue !== 'Male' && value.targetValue !== 'Female') throw new AppError('Lütfen geçerli bir cinsiyet seçiniz.', 400);
    targetValues = [value.targetValue];
    targetValue = value.targetValue;
  } else if (targetType !== NotificationTargetType.ALL) {
    targetValues = parseTargetList(value.targetValue, targetType);
    targetValue = JSON.stringify(targetValues);
  }

  return {
    title: boundedText(value.title, 'Bildirim başlığı', 120, { required: true, casing: 'upper' })!,
    message: boundedText(value.message, 'Bildirim mesajı', 2000, { required: true, casing: 'upper' })!,
    priority: priority as NotificationPriority,
    targetType,
    targetValues,
    targetValue,
  };
}

export function validateNotificationQuery(input: Record<string, unknown>): {
  page: number;
  pageSize: number;
  search?: string;
  sender?: string;
  priority?: NotificationPriority;
  targetType?: NotificationTargetType;
  dateStart?: Date;
  dateEnd?: Date;
} {
  const priorityRaw = singleQueryValue(input.priority, 'Öncelik filtresi');
  const targetTypeRaw = singleQueryValue(input.targetType, 'Hedef türü filtresi');
  if (priorityRaw && priorityRaw !== 'ALL' && !priorities.has(priorityRaw)) throw new AppError('Geçersiz öncelik filtresi.', 400);
  if (targetTypeRaw && targetTypeRaw !== 'ANY' && !targetTypes.has(targetTypeRaw)) throw new AppError('Geçersiz hedef türü filtresi.', 400);

  const dateStartRaw = singleQueryValue(input.dateStart, 'Başlangıç tarihi');
  const dateEndRaw = singleQueryValue(input.dateEnd, 'Bitiş tarihi');
  const dateStart = parseIstanbulDateBoundary(dateStartRaw, false);
  const dateEnd = parseIstanbulDateBoundary(dateEndRaw, true);
  assertDateRange(dateStart, dateEnd);

  return {
    page: parsePositiveInteger(input.page, 'Sayfa', 1, 100_000),
    pageSize: parsePositiveInteger(input.pageSize, 'Sayfa boyutu', 25, 50),
    search: boundedText(singleQueryValue(input.search, 'Arama metni'), 'Arama metni', 200, { casing: 'preserve' }) || undefined,
    sender: boundedText(singleQueryValue(input.sender, 'Gönderen filtresi'), 'Gönderen filtresi', 120, { casing: 'preserve' }) || undefined,
    priority: priorityRaw && priorityRaw !== 'ALL' ? priorityRaw as NotificationPriority : undefined,
    targetType: targetTypeRaw && targetTypeRaw !== 'ANY' ? targetTypeRaw as NotificationTargetType : undefined,
    dateStart,
    dateEnd,
  };
}

export function validateNotificationId(value: unknown, label = 'Duyuru kimliği'): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new AppError(`${label} geçersiz.`, 400);
  return value;
}

export function validateIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new AppError('Idempotency-Key başlığı geçerli bir UUID olmalıdır.', 400);
  return value;
}
