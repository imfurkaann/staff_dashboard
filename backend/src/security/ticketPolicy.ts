import { SupportTicketStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

export const TICKET_CATEGORIES = [
  'GÜRÜLTÜ / RAHATSIZLIK',
  'İNTERNET / İLETİŞİM',
  'EK EŞYA / MOBİLYA',
  'TEMİZLİK / ÇEVRE',
  'GENEL TALEPLER',
  'DİĞER',
] as const;

const ticketCategorySet = new Set<string>(TICKET_CATEGORIES);
const ticketStatusSet = new Set<string>(Object.values(SupportTicketStatus));

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${label} gereklidir.`, 400);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(`${label} en fazla ${maxLength} karakter olabilir.`, 400);
  }
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new AppError(`${label} metin olmalıdır.`, 400);
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(`${label} en fazla ${maxLength} karakter olabilir.`, 400);
  }
  return normalized;
}

export function validateTicketCreateInput(input: unknown): {
  category: string;
  subject: string;
  description: string;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('Talep bilgileri geçersiz.', 400);
  }
  const value = input as Record<string, unknown>;
  const category = requiredText(value.category, 'Kategori', 60);
  if (!ticketCategorySet.has(category)) throw new AppError('Geçersiz talep kategorisi.', 400);

  return {
    category,
    subject: requiredText(value.subject, 'Talep / Şikayet konusu', 200),
    description: requiredText(value.description, 'Talep / Şikayet detaylı açıklaması', 5000),
  };
}

export function validateTicketStatusInput(input: unknown): {
  status: SupportTicketStatus;
  adminNote?: string;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('Durum güncelleme bilgileri geçersiz.', 400);
  }
  const value = input as Record<string, unknown>;
  if (typeof value.status !== 'string' || !ticketStatusSet.has(value.status)) {
    throw new AppError('Geçersiz talep durumu.', 400);
  }
  const adminNote = optionalText(value.adminNote, 'Yönetim notu', 5000);
  if (value.status === SupportTicketStatus.REJECTED && !adminNote) {
    throw new AppError('Reddedilen talepler için yönetim notu gereklidir.', 400);
  }
  return { status: value.status as SupportTicketStatus, adminNote };
}

export function validateTicketFilters(input: { status?: unknown; category?: unknown; search?: unknown }): {
  status?: SupportTicketStatus;
  category?: string;
  search?: string;
} {
  let status: SupportTicketStatus | undefined;
  let category: string | undefined;
  if (input.status !== undefined && input.status !== 'ALL') {
    if (typeof input.status !== 'string' || !ticketStatusSet.has(input.status)) {
      throw new AppError('Geçersiz talep durumu filtresi.', 400);
    }
    status = input.status as SupportTicketStatus;
  }
  if (input.category !== undefined && input.category !== 'ALL') {
    if (typeof input.category !== 'string' || !ticketCategorySet.has(input.category)) {
      throw new AppError('Geçersiz talep kategorisi filtresi.', 400);
    }
    category = input.category;
  }
  return { status, category, search: optionalText(input.search, 'Arama metni', 200) };
}

export function validateTicketId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError('Geçersiz talep kimliği.', 400);
  }
  return value;
}
