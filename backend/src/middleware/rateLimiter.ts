import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Rate limiter for Login attempts: Configured via env
export const loginRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Çok fazla hatalı giriş denemesi yapıldı. Lütfen biraz sonra tekrar deneyiniz.',
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Çok fazla API isteği gönderildi. Lütfen kısa süre sonra yeniden deneyin.' },
});
