import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import prisma from '../db/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { appRoles, isAppRole } from '../security/permissions';

const privilegedRoles = new Set<Role>([Role.ADMIN, Role.HOUSING_MANAGER]);
const usernamePattern = /^[a-z0-9._-]{3,50}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanUsername(value: unknown) {
  const username = typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : '';
  if (!usernamePattern.test(username)) throw new AppError('Kullanıcı adı 3-50 karakter olmalı; yalnızca küçük harf, rakam, nokta, tire ve alt çizgi içermelidir.', 400);
  return username;
}

function cleanEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : '';
  if (email.length > 254 || !emailPattern.test(email)) throw new AppError('Geçerli bir e-posta adresi girilmelidir.', 400);
  return email;
}

function cleanFullName(value: unknown) {
  const fullName = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (fullName.length < 2 || fullName.length > 120) throw new AppError('Ad soyad 2-120 karakter olmalıdır.', 400);
  return fullName.toLocaleUpperCase('tr-TR');
}

function validatePassword(value: unknown) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 12 || !/[A-ZÇĞİÖŞÜ]/.test(password) || !/[a-zçğıöşü]/.test(password) || !/\d/.test(password) || !/[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(password)) {
    throw new AppError('Parola en az 12 karakter; büyük harf, küçük harf, rakam ve özel karakter içermelidir.', 400);
  }
  return password;
}

function parseRole(value: unknown): Role {
  if (!isAppRole(value)) throw new AppError(`Geçersiz kullanıcı rolü. İzin verilen roller: ${appRoles.join(', ')}`, 400);
  return value as Role;
}

async function protectPrivilegedAccess(targetId: string, actorId: string, currentRole: Role, nextRole: Role, nextActive: boolean) {
  if (targetId === actorId && (nextRole !== currentRole || !nextActive)) {
    throw new AppError('Kendi rolünüzü değiştiremez veya kendi hesabınızı kapatamazsınız.', 409);
  }
  if (privilegedRoles.has(currentRole) && (!privilegedRoles.has(nextRole) || !nextActive)) {
    const otherManagers = await prisma.user.count({
      where: { id: { not: targetId }, isActive: true, role: { in: [Role.ADMIN, Role.HOUSING_MANAGER] } },
    });
    if (otherManagers === 0) throw new AppError('Sistemde en az bir aktif Sistem Yöneticisi veya Lojman Müdürü kalmalıdır.', 409);
  }
}

const publicUserSelect = {
  id: true, username: true, email: true, fullName: true, role: true, isActive: true,
  lastLoginAt: true, createdAt: true, updatedAt: true,
  employee: { select: { id: true, registrationNo: true, firstName: true, lastName: true, department: true, title: true } },
  userAuditHistory: {
    take: 20,
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, action: true, beforeRole: true, afterRole: true, notes: true, createdAt: true, actorUser: { select: { fullName: true } } },
  },
};

export class UserManagementService {
  static async listUsers() {
    return prisma.user.findMany({ orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }], select: publicUserSelect });
  }

  static async createUser(data: { username?: unknown; email?: unknown; fullName?: unknown; role?: unknown; password?: unknown }, actorId: string) {
    const username = cleanUsername(data.username);
    const email = cleanEmail(data.email);
    const fullName = cleanFullName(data.fullName);
    const role = parseRole(data.role);
    if (role === Role.STAFF) throw new AppError('Personel portal hesabı Personel Yönetimi üzerinden ilgili personele bağlı olarak oluşturulmalıdır.', 400);
    const passwordHash = await bcrypt.hash(validatePassword(data.password), config.security.saltRounds);

    return prisma.$transaction(async (tx) => {
      const duplicate = await tx.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { id: true } });
      if (duplicate) throw new AppError('Kullanıcı adı veya e-posta adresi başka bir hesapta kullanılıyor.', 409);
      const created = await tx.user.create({ data: { username, email, fullName, role, passwordHash } });
      await tx.userAuditLog.create({ data: { targetUserId: created.id, actorUserId: actorId, action: 'USER_CREATED', afterRole: role, notes: 'YÖNETİM HESABI OLUŞTURULDU' } });
      return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: publicUserSelect });
    });
  }

  static async updateUser(targetId: string, data: { email?: unknown; fullName?: unknown; role?: unknown; isActive?: unknown }, actorId: string) {
    const current = await prisma.user.findUnique({ where: { id: targetId } });
    if (!current) throw new AppError('Kullanıcı hesabı bulunamadı.', 404);
    const role = data.role === undefined ? current.role : parseRole(data.role);
    const isActive = data.isActive === undefined ? current.isActive : data.isActive;
    if (typeof isActive !== 'boolean') throw new AppError('Hesap aktiflik bilgisi geçersiz.', 400);
    await protectPrivilegedAccess(targetId, actorId, current.role, role, isActive);

    const email = data.email === undefined ? current.email : cleanEmail(data.email);
    const fullName = data.fullName === undefined ? current.fullName : cleanFullName(data.fullName);
    return prisma.$transaction(async (tx) => {
      const duplicate = await tx.user.findFirst({ where: { email, id: { not: targetId } }, select: { id: true } });
      if (duplicate) throw new AppError('E-posta adresi başka bir hesapta kullanılıyor.', 409);
      await tx.user.update({ where: { id: targetId }, data: { email, fullName, role, isActive } });
      await tx.userAuditLog.create({ data: {
        targetUserId: targetId, actorUserId: actorId, action: 'USER_UPDATED', beforeRole: current.role, afterRole: role,
        notes: `HESAP: ${current.isActive ? 'AKTİF' : 'PASİF'} → ${isActive ? 'AKTİF' : 'PASİF'}`,
      } });
      return tx.user.findUniqueOrThrow({ where: { id: targetId }, select: publicUserSelect });
    });
  }

  static async resetPassword(targetId: string, password: unknown, actorId: string) {
    const current = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } });
    if (!current) throw new AppError('Kullanıcı hesabı bulunamadı.', 404);
    const passwordHash = await bcrypt.hash(validatePassword(password), config.security.saltRounds);
    await prisma.$transaction([
      prisma.user.update({ where: { id: targetId }, data: { passwordHash } }),
      prisma.userAuditLog.create({ data: { targetUserId: targetId, actorUserId: actorId, action: 'PASSWORD_RESET', beforeRole: current.role, afterRole: current.role, notes: 'PAROLA YÖNETİCİ TARAFINDAN YENİLENDİ' } }),
    ]);
    return { updated: true };
  }
}
