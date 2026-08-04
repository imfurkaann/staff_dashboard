import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  appName: process.env.APP_NAME || 'LojmanYönetim',
  appSubtitle: process.env.APP_SUBTITLE || 'Personel Konaklama & Lojman Portalı',
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback_secret_key_change_in_env',
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },
  cookie: {
    secret: process.env.COOKIE_SECRET || 'fallback_cookie_secret',
    name: process.env.COOKIE_NAME || 'token',
    maxAgeMs: parseInt(process.env.COOKIE_MAX_AGE_DAYS || '30', 10) * 24 * 60 * 60 * 1000,
  },
  cors: {
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
    apiMax: parseInt(process.env.API_RATE_LIMIT_MAX || '500', 10),
  },
  visitor: {
    exportMaxRows: Math.min(Math.max(parseInt(process.env.VISITOR_EXPORT_MAX_ROWS || '5000', 10) || 5000, 100), 50000),
  },
  security: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    encryptionKey: process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'development_only_encryption_key',
  },
};

export function validateConfig(): void {
  if (config.nodeEnv !== 'production') return;
  const missing = [
    ['DATABASE_URL', config.databaseUrl],
    ['JWT_SECRET', process.env.JWT_SECRET],
    ['COOKIE_SECRET', process.env.COOKIE_SECRET],
    ['DATA_ENCRYPTION_KEY', process.env.DATA_ENCRYPTION_KEY],
    ['CORS_ALLOWED_ORIGINS', process.env.CORS_ALLOWED_ORIGINS],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) throw new Error(`Eksik production ortam değişkenleri: ${missing.join(', ')}`);
  if (config.jwt.secret.length < 32 || config.cookie.secret.length < 32) {
    throw new Error('JWT_SECRET ve COOKIE_SECRET en az 32 karakter olmalıdır.');
  }
  if (config.security.encryptionKey.length < 32) throw new Error('DATA_ENCRYPTION_KEY en az 32 karakter olmalıdır.');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT değeri geçersiz.');
  if (!Number.isInteger(config.rateLimit.apiMax) || config.rateLimit.apiMax < 10) throw new Error('API_RATE_LIMIT_MAX değeri en az 10 olmalıdır.');
}
