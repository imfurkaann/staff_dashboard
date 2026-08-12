import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import prisma from '../db/prisma';
import { config } from '../config';
import { AuthService } from '../services/authService';
import { hasAllPermissions, hasAnyPermission, Permission } from '../security/permissions';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: string;
    mustChangePassword: boolean;
  };
}

export function isPasswordChangeRoute(baseUrl: string, path: string): boolean {
  return baseUrl === '/api/auth' && (path === '/me' || path === '/change-password');
}

/**
 * Validates JWT token from HTTP-Only Cookie or Authorization Header
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract token from Cookie or Bearer Header
    let token = req.cookies?.[config.cookie.name] || req.signedCookies?.[config.cookie.name];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Oturum geçersiz veya giriş yapılmamış. Lütfen tekrar giriş yapınız.', 401);
    }

    // Verify token payload
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; role: string; pwd?: string };

    // Verify active user status in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new AppError('Kullanıcı hesabı bulunamadı.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Kullanıcı hesabı dondurulmuş. Lütfen sistem yöneticinizle iletişime geçin.', 403);
    }

    if (!decoded.pwd || decoded.pwd !== AuthService.passwordVersion(user.passwordHash)) {
      throw new AppError('Oturum güvenlik bilgileri değişti. Lütfen tekrar giriş yapın.', 401);
    }

    const { passwordHash: _passwordHash, isActive: _isActive, ...safeUser } = user;
    req.user = safeUser;
    const passwordChangeAllowed = isPasswordChangeRoute(req.baseUrl, req.path);
    if (safeUser.mustChangePassword && !passwordChangeAllowed) {
      throw new AppError('Devam etmeden önce geçici parolanızı değiştirmeniz gerekir.', 428);
    }
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Oturum süresi dolmuş veya geçersiz. Lütfen tekrar giriş yapın.', 401));
    }
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) middleware
 */
export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user?.mustChangePassword) {
      return next(new AppError('Devam etmeden önce geçici parolanızı değiştirmeniz gerekir.', 428));
    }
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('Bu işlem için yetkiniz bulunmamaktadır.', 403)
      );
    }
    next();
  };
};

export const authorizePermissions = (...required: Permission[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (req.user?.mustChangePassword) {
      return next(new AppError('Devam etmeden önce geçici parolanızı değiştirmeniz gerekir.', 428));
    }
    if (!req.user || !hasAllPermissions(req.user.role, required)) {
      return next(new AppError('Bu işlem için gerekli yetkiniz bulunmamaktadır.', 403));
    }
    next();
  };
};

export const authorizeAnyPermission = (...required: Permission[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (req.user?.mustChangePassword) {
      return next(new AppError('Devam etmeden önce geçici parolanızı değiştirmeniz gerekir.', 428));
    }
    if (!req.user || !hasAnyPermission(req.user.role, required)) {
      return next(new AppError('Bu işlem için gerekli yetkiniz bulunmamaktadır.', 403));
    }
    next();
  };
};
