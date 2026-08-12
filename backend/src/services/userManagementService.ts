import bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import prisma from '../db/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { roleCatalog } from '../security/permissions';
import { validatePassword } from '../security/passwordPolicy';
import {
  assertAccountRoleLink,
  assertSelfUpdateAllowed,
  cleanEmail,
  cleanFullName,
  cleanUsername,
  parseRole,
  UserListFilters,
} from '../security/userManagementPolicy';

const privilegedRoles = new Set<Role>([Role.ADMIN, Role.HOUSING_MANAGER]);

const employeeSelect = {
  id: true,
  registrationNo: true,
  firstName: true,
  lastName: true,
  department: true,
  title: true,
  isDeleted: true,
} as const;

const userSummarySelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: employeeSelect },
} as const;

const userDetailSelect = {
  ...userSummarySelect,
  userAuditHistory: {
    take: 50,
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      action: true,
      beforeRole: true,
      afterRole: true,
      notes: true,
      createdAt: true,
      actorUser: { select: { id: true, fullName: true, username: true } },
    },
  },
} as const;

async function protectPrivilegedAccess(
  tx: Prisma.TransactionClient,
  targetId: string,
  currentRole: Role,
  nextRole: Role,
  nextActive: boolean,
): Promise<void> {
  if (privilegedRoles.has(currentRole) && (!privilegedRoles.has(nextRole) || !nextActive)) {
    const otherManagers = await tx.user.count({
      where: { id: { not: targetId }, isActive: true, role: { in: [Role.ADMIN, Role.HOUSING_MANAGER] } },
    });
    if (otherManagers === 0) {
      throw new AppError('Sistemde en az bir aktif Sistem Yöneticisi veya Lojman Müdürü kalmalıdır.', 409);
    }
  }
}

function mutationConflict(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new AppError('Kullanıcı adı veya e-posta adresi başka bir hesapta kullanılıyor.', 409);
    if (error.code === 'P2034') throw new AppError('Kullanıcı hesabı aynı anda başka bir işlemde değiştirildi. Sayfayı yenileyip tekrar deneyin.', 409);
  }
  throw error;
}

function auditNotes(current: { email: string; fullName: string; role: Role; isActive: boolean }, next: { email: string; fullName: string; role: Role; isActive: boolean }): string {
  const changes: string[] = [];
  if (current.email !== next.email) changes.push('E-POSTA GÜNCELLENDİ');
  if (current.fullName !== next.fullName) changes.push('AD SOYAD GÜNCELLENDİ');
  if (current.role !== next.role) changes.push(`ROL: ${current.role} → ${next.role}`);
  if (current.isActive !== next.isActive) changes.push(`HESAP: ${current.isActive ? 'AKTİF' : 'PASİF'} → ${next.isActive ? 'AKTİF' : 'PASİF'}`);
  return changes.join(' · ') || 'DEĞİŞİKLİK YAPILMADI';
}

export class UserManagementService {
  static async listUsers(filters: UserListFilters) {
    const where: Prisma.UserWhereInput = {};
    if (filters.role) where.role = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { employee: { is: { registrationNo: { contains: filters.search, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        select: userSummarySelect,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page: filters.page, pageSize: filters.pageSize };
  }

  static getRoleCatalog() {
    return roleCatalog;
  }

  static async getUser(targetId: string) {
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: userDetailSelect });
    if (!user) throw new AppError('Kullanıcı hesabı bulunamadı.', 404);
    return user;
  }

  static async createUser(data: { username?: unknown; email?: unknown; fullName?: unknown; role?: unknown; password?: unknown }, actorId: string) {
    const username = cleanUsername(data.username);
    const email = cleanEmail(data.email);
    const fullName = cleanFullName(data.fullName);
    const role = parseRole(data.role);
    if (role === Role.STAFF) {
      throw new AppError('Personel portal hesabı Personel Yönetimi üzerinden ilgili personele bağlı olarak oluşturulmalıdır.', 400);
    }
    const passwordHash = await bcrypt.hash(validatePassword(data.password, 'Geçici parola'), config.security.saltRounds);

    try {
      return await prisma.$transaction(async (tx) => {
        const duplicate = await tx.user.findFirst({ where: { OR: [{ username }, { email }] }, select: { id: true } });
        if (duplicate) throw new AppError('Kullanıcı adı veya e-posta adresi başka bir hesapta kullanılıyor.', 409);
        const created = await tx.user.create({
          data: { username, email, fullName, role, passwordHash, mustChangePassword: true },
        });
        await tx.userAuditLog.create({
          data: {
            targetUserId: created.id,
            actorUserId: actorId,
            action: 'USER_CREATED',
            afterRole: role,
            notes: 'YÖNETİM HESABI OLUŞTURULDU · İLK GİRİŞTE PAROLA DEĞİŞİMİ ZORUNLU',
          },
        });
        return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userDetailSelect });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return mutationConflict(error);
    }
  }

  static async updateUser(targetId: string, data: { email?: unknown; fullName?: unknown; role?: unknown; isActive?: unknown }, actorId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: targetId },
          select: { email: true, fullName: true, role: true, isActive: true, updatedAt: true, employee: { select: { id: true } } },
        });
        if (!current) throw new AppError('Kullanıcı hesabı bulunamadı.', 404);

        const role = data.role === undefined ? current.role : parseRole(data.role);
        const isActive = data.isActive === undefined ? current.isActive : data.isActive;
        if (typeof isActive !== 'boolean') throw new AppError('Hesap aktiflik bilgisi geçersiz.', 400);
        assertSelfUpdateAllowed(targetId, actorId, current.role, role, isActive);
        assertAccountRoleLink(Boolean(current.employee), current.role, role);
        await protectPrivilegedAccess(tx, targetId, current.role, role, isActive);

        const email = data.email === undefined ? current.email : cleanEmail(data.email);
        const fullName = data.fullName === undefined ? current.fullName : cleanFullName(data.fullName);
        const duplicate = await tx.user.findFirst({ where: { email, id: { not: targetId } }, select: { id: true } });
        if (duplicate) throw new AppError('E-posta adresi başka bir hesapta kullanılıyor.', 409);

        const updated = await tx.user.updateMany({
          where: { id: targetId, updatedAt: current.updatedAt },
          data: { email, fullName, role, isActive },
        });
        if (updated.count !== 1) throw new AppError('Kullanıcı hesabı aynı anda başka bir işlemde değiştirildi. Sayfayı yenileyip tekrar deneyin.', 409);

        await tx.userAuditLog.create({
          data: {
            targetUserId: targetId,
            actorUserId: actorId,
            action: 'USER_UPDATED',
            beforeRole: current.role,
            afterRole: role,
            notes: auditNotes(current, { email, fullName, role, isActive }),
          },
        });
        return tx.user.findUniqueOrThrow({ where: { id: targetId }, select: userDetailSelect });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return mutationConflict(error);
    }
  }

  static async resetPassword(targetId: string, password: unknown, actorId: string) {
    if (targetId === actorId) {
      throw new AppError('Kendi parolanızı yönetici sıfırlamasıyla değiştiremezsiniz. Profildeki parola değiştirme akışını kullanın.', 409);
    }
    const passwordHash = await bcrypt.hash(validatePassword(password, 'Geçici parola'), config.security.saltRounds);
    try {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, updatedAt: true } });
        if (!current) throw new AppError('Kullanıcı hesabı bulunamadı.', 404);
        const updated = await tx.user.updateMany({
          where: { id: targetId, updatedAt: current.updatedAt },
          data: { passwordHash, mustChangePassword: true },
        });
        if (updated.count !== 1) throw new AppError('Kullanıcı hesabı aynı anda başka bir işlemde değiştirildi. Sayfayı yenileyip tekrar deneyin.', 409);
        await tx.userAuditLog.create({
          data: {
            targetUserId: targetId,
            actorUserId: actorId,
            action: 'PASSWORD_RESET',
            beforeRole: current.role,
            afterRole: current.role,
            notes: 'PAROLA YÖNETİCİ TARAFINDAN YENİLENDİ · İLK GİRİŞTE DEĞİŞİM ZORUNLU',
          },
        });
        return { updated: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return mutationConflict(error);
    }
  }
}
