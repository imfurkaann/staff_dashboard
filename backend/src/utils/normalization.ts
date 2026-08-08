import { AppError } from '../middleware/errorHandler';

export const TURKISH_LOCALE = 'tr-TR';

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeTitleCase(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const clean = collapseWhitespace(value);
  if (!clean) return null;
  return clean
    .split(' ')
    .map((word) => word.charAt(0).toLocaleUpperCase(TURKISH_LOCALE) + word.slice(1).toLocaleLowerCase(TURKISH_LOCALE))
    .join(' ');
}

export function normalizeUpper(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const clean = collapseWhitespace(value);
  return clean ? clean.toLocaleUpperCase(TURKISH_LOCALE) : null;
}

export function normalizeIdentifier(value?: string | null): string | null {
  return normalizeUpper(value)?.replace(/\s+/g, '') || null;
}

export function normalizeInventoryItemName(value?: string | null): string | null {
  const upper = normalizeUpper(value);
  if (!upper) return null;
  const lookupKey = upper.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^A-Z0-9]/g, '');
  const aliases: Record<string, string> = {
    NEVRESIM: 'NEVRESİM',
    NEVREIN: 'NEVRESİM',
    NEVREIM: 'NEVRESİM',
  };
  return aliases[lookupKey] || upper;
}

export function normalizePhone(value?: string | null, fieldName = 'Telefon numarası'): string | null {
  if (value === undefined || value === null || !value.trim()) return null;
  const clean = value.trim().replace(/[\s()-]/g, '');
  if (!/^\+?\d{10,15}$/.test(clean)) throw new AppError(`${fieldName} 10-15 rakamdan oluşmalıdır.`, 400);
  return clean;
}

export function boundedText(
  value: unknown,
  fieldName: string,
  maxLength: number,
  options: { required?: boolean; minLength?: number; casing?: 'title' | 'upper' | 'preserve' } = {},
): string | null {
  if (value === undefined || value === null) {
    if (options.required) throw new AppError(`${fieldName} zorunludur.`, 400);
    return null;
  }
  if (typeof value !== 'string') throw new AppError(`${fieldName} metin olmalıdır.`, 400);
  const collapsed = collapseWhitespace(value);
  if (!collapsed) {
    if (options.required) throw new AppError(`${fieldName} zorunludur.`, 400);
    return null;
  }
  const minLength = options.minLength ?? 1;
  if (collapsed.length < minLength || collapsed.length > maxLength) {
    throw new AppError(`${fieldName} ${minLength}-${maxLength} karakter arasında olmalıdır.`, 400);
  }
  if (options.casing === 'title') return normalizeTitleCase(collapsed);
  if (options.casing === 'upper') return normalizeUpper(collapsed);
  return collapsed;
}

export function strictBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') throw new AppError(`${fieldName} doğru/yanlış değeri olmalıdır.`, 400);
  return value;
}
