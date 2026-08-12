import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from './errorHandler';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Blocks cross-site state changes authenticated by cookies. */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || req.headers.authorization?.startsWith('Bearer ')) return next();

  if (req.get('sec-fetch-site') === 'cross-site') {
    return next(new AppError('Çapraz site isteği güvenlik politikası nedeniyle reddedildi.', 403));
  }
  const origin = req.get('origin');
  if (!origin) {
    if (config.nodeEnv === 'production' && req.cookies?.[config.cookie.name]) {
      return next(new AppError('İstek kaynağı doğrulanamadı.', 403));
    }
    return next();
  }
  const localDevelopmentOrigin = config.nodeEnv === 'development' && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+$/.test(origin);
  if (!config.cors.allowedOrigins.includes(origin) && !localDevelopmentOrigin) {
    return next(new AppError('İstek kaynağı güvenlik politikası nedeniyle reddedildi.', 403));
  }
  next();
}
