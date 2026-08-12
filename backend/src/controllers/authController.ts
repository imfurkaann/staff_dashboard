import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { config } from '../config';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const { usernameOrEmail, password } = req.body;
      const result = await AuthService.login({ usernameOrEmail, password });

      // Set Secure HTTP-Only Cookie via central config
      res.cookie(config.cookie.name, result.token, {
        httpOnly: true,
        secure: config.cookie.secure,
        sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
        path: '/',
        maxAge: config.cookie.maxAgeMs,
        priority: 'high',
      });

      res.status(200).json({
        success: true,
        message: 'Giriş başarılı. Hoş geldiniz!',
        data: { user: result.user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  public static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.clearCookie(config.cookie.name, {
        httpOnly: true,
        secure: config.cookie.secure,
        sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
        path: '/',
      });

      res.status(200).json({
        success: true,
        message: 'Güvenli çıkış yapıldı.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  public static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/change-password
   */
  public static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const userId = req.user!.id;
      const { oldPassword, newPassword } = req.body;

      const result = await AuthService.changePassword({ userId, oldPassword, newPassword });

      res.clearCookie(config.cookie.name, {
        httpOnly: true,
        secure: config.cookie.secure,
        sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
        path: '/',
      });

      res.status(200).json({
        success: true,
        message: `${result.message} Güvenlik nedeniyle yeniden giriş yapınız.`,
      });
    } catch (error) {
      next(error);
    }
  }
}
