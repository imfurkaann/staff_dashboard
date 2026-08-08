import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/prisma';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import crypto from 'crypto';

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
    const { usernameOrEmail, password } = data;

    if (!usernameOrEmail || !password) {
      throw new AppError('Kullanıcı adı/E-posta ve şifre girilmesi zorunludur.', 400);
    }

    const sanitizedIdentifier = usernameOrEmail.toLowerCase().trim();

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
      },
      token,
    };
  }

  /**
   * Secure Password Change Method
   */
  public static async changePassword(data: ChangePasswordDTO) {
    const { userId, oldPassword, newPassword } = data;

    if (!oldPassword || !newPassword) {
      throw new AppError('Mevcut şifre ve yeni şifre girilmesi zorunludur.', 400);
    }

    if (newPassword.length < 10 || !/[A-ZÇĞİÖŞÜ]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw new AppError('Yeni şifre en az 10 karakter, bir büyük harf ve bir rakam içermelidir.', 400);
    }

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

    const newPasswordHash = await bcrypt.hash(newPassword, config.security.saltRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: 'Şifreniz başarıyla güncellendi.' };
  }
}
