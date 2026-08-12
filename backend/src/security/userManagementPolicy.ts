import { Role } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { appRoles, isAppRole } from './permissions';

const usernamePattern = /^[a-z0-9._-]{3,50}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanUsername(value: unknown): string {
  const username = typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : '';
  if (!usernamePattern.test(username)) {
    throw new AppError('Kullanıcı adı 3-50 karakter olmalı; yalnızca küçük harf, rakam, nokta, tire ve alt çizgi içermelidir.', 400);
  }
  return username;
}

export function cleanEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : '';
  if (email.length > 254 || !emailPattern.test(email)) throw new AppError('Geçerli bir e-posta adresi girilmelidir.', 400);
  return email;
}

export function cleanFullName(value: unknown): string {
  const fullName = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (fullName.length < 2 || fullName.length > 120) throw new AppError('Ad soyad 2-120 karakter olmalıdır.', 400);
  return fullName.toLocaleUpperCase('tr-TR');
}

export function parseRole(value: unknown): Role {
  if (!isAppRole(value)) throw new AppError(`Geçersiz kullanıcı rolü. İzin verilen roller: ${appRoles.join(', ')}`, 400);
  return value as Role;
}

export function validateUserId(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AppError('Geçersiz kullanıcı kimliği.', 400);
  return value;
}

export function assertAccountRoleLink(employeeLinked: boolean, currentRole: Role, nextRole: Role): void {
  if (employeeLinked && nextRole !== Role.STAFF) {
    throw new AppError('Personele bağlı portal hesabının rolü yalnızca STAFF olabilir. Rol, Personel Yönetimi bağlantısıyla korunur.', 409);
  }
  if (!employeeLinked && currentRole !== Role.STAFF && nextRole === Role.STAFF) {
    throw new AppError('STAFF rolü yalnızca Personel Yönetimi üzerinden bir personel kaydına bağlı olarak oluşturulabilir.', 409);
  }
}

export function assertSelfUpdateAllowed(targetId: string, actorId: string, currentRole: Role, nextRole: Role, nextActive: boolean): void {
  if (targetId === actorId && (nextRole !== currentRole || !nextActive)) {
    throw new AppError('Kendi rolünüzü değiştiremez veya kendi hesabınızı kapatamazsınız.', 409);
  }
}

export interface UserListFilters {
  search?: string;
  role?: Role;
  isActive?: boolean;
  page: number;
  pageSize: number;
}

function singleQueryValue(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new AppError(`${label} filtresi geçersiz.`, 400);
  return value;
}

export function parseUserListFilters(input: Record<string, unknown>): UserListFilters {
  const rawSearch = singleQueryValue(input.search, 'Arama');
  const search = rawSearch?.trim();
  if (search && search.length > 120) throw new AppError('Arama metni en fazla 120 karakter olabilir.', 400);

  const rawRole = singleQueryValue(input.role, 'Rol');
  const role = rawRole && rawRole !== 'ALL' ? parseRole(rawRole) : undefined;

  const rawStatus = singleQueryValue(input.status, 'Durum');
  let isActive: boolean | undefined;
  if (rawStatus && rawStatus !== 'ALL') {
    if (rawStatus !== 'ACTIVE' && rawStatus !== 'INACTIVE') throw new AppError('Durum filtresi geçersiz.', 400);
    isActive = rawStatus === 'ACTIVE';
  }

  const rawPage = singleQueryValue(input.page, 'Sayfa');
  const rawPageSize = singleQueryValue(input.pageSize, 'Sayfa boyutu');
  const page = rawPage === undefined ? 1 : Number(rawPage);
  const pageSize = rawPageSize === undefined ? 25 : Number(rawPageSize);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw new AppError('Sayfa numarası geçersiz.', 400);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new AppError('Sayfa boyutu 1-100 arasında olmalıdır.', 400);

  return { search: search || undefined, role, isActive, page, pageSize };
}
