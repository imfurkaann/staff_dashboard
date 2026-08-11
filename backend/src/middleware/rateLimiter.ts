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

export const ticketCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Bir saat içinde en fazla 10 talep oluşturabilirsiniz.' },
});

export const notificationSendRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Bir saat içinde en fazla 30 duyuru gönderebilirsiniz.' },
});

export const visitorCreateRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Bir saat içinde en fazla 120 ziyaretçi girişi oluşturabilirsiniz.' },
});

export const visitorMutationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Çok fazla ziyaretçi işlemi yapıldı. Lütfen kısa süre sonra yeniden deneyin.' },
});

export const roomMutationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Çok fazla oda yönetimi işlemi yapıldı. Lütfen kısa süre sonra yeniden deneyin.' },
});

export const employeeMutationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Çok fazla personel yönetimi işlemi yapıldı. Lütfen kısa süre sonra yeniden deneyin.' },
});

export const employeeAccountRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Çok fazla personel hesabı işlemi yapıldı. Lütfen daha sonra yeniden deneyin.' },
});

export const stockMutationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Çok fazla depo/stok işlemi yapıldı. Lütfen kısa süre sonra yeniden deneyin.' },
});

export const pushTestRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user.id,
  message: { success: false, message: 'Telefon bildirimi testi bir saat içinde en fazla 5 kez yapılabilir.' },
});
