import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import crypto from 'crypto';
import { validateLoginPassword, validatePassword } from '../security/passwordPolicy';

const DUMMY_PASSWORD_HASH = '$2a$12$FKrZcHDuELT40ixHK1a1TOYqRGHrJYlQ5nlA/ApxePTb090ZkgZo6';

export interface LoginDTO {
  usernameOrEmail: string;
  password: string;
}

export interface ChangePasswordDTO {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

export class AuthService {
  /**
   * Generates secure JWT token for authenticated user using central config
   */
  public static passwordVersion(passwordHash: string): string {
    return crypto.createHash('sha256').update(passwordHash).digest('base64url').slice(0, 22);
  }

  public static generateToken(userId: string, role: string, passwordHash: string): string {
    return jwt.sign({ id: userId, role, pwd: this.passwordVersion(passwordHash) }, config.jwt.secret, { expiresIn: config.jwt.expiresIn as any });
  }

  /**
   * Secure User login logic with bcrypt password verification
   */
  public static async login(data: LoginDTO) {
    const rawIdentifier = typeof data.usernameOrEmail === 'string' ? data.usernameOrEmail : '';
    const sanitizedIdentifier = rawIdentifier.toLocaleLowerCase('en-US').trim();
    if (!sanitizedIdentifier || sanitizedIdentifier.length > 254) {
      throw new AppError('Kullanıcı adı veya şifre hatalı.', 401);
    }
    const password = validateLoginPassword(data.password);

    // Find active user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: sanitizedIdentifier },
          { email: sanitizedIdentifier },
        ],
      },
    });

    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new AppError('Kullanıcı adı veya şifre hatalı.', 401);
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Kullanıcı adı veya şifre hatalı.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Hesabınız dondurulmuş. Lütfen sistem yöneticinizle iletişime geçin.', 403);
    }

    // Update last login timestamp asynchronously
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate persistent JWT token
    const token = this.generateToken(user.id, user.role, user.passwordHash);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      token,
    };
  }

  /**
   * Secure Password Change Method
   */
  public static async changePassword(data: ChangePasswordDTO) {
    const { userId, oldPassword, newPassword } = data;

    if (typeof oldPassword !== 'string' || !oldPassword || typeof newPassword !== 'string' || !newPassword) {
      throw new AppError('Mevcut şifre ve yeni şifre girilmesi zorunludur.', 400);
    }
    validateLoginPassword(oldPassword);
    const validatedNewPassword = validatePassword(newPassword, 'Yeni parola');

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }

    const isOldValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldValid) {
      throw new AppError('Mevcut şifreniz hatalı.', 400);
    }

    if (await bcrypt.compare(validatedNewPassword, user.passwordHash)) {
      throw new AppError('Yeni parola mevcut parolanızdan farklı olmalıdır.', 400);
    }

    const newPasswordHash = await bcrypt.hash(validatedNewPassword, config.security.saltRounds);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash, mustChangePassword: false },
      }),
      prisma.userAuditLog.create({
        data: {
          targetUserId: userId,
          actorUserId: userId,
          action: 'PASSWORD_CHANGED',
          beforeRole: user.role,
          afterRole: user.role,
          notes: 'KULLANICI PAROLASINI GÜVENLİ ŞEKİLDE DEĞİŞTİRDİ',
        },
      }),
    ]);

    return { success: true, message: 'Şifreniz başarıyla güncellendi.' };
  }
}
