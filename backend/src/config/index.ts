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
  room: {
    occupancyExportMaxRows: Math.min(Math.max(parseInt(process.env.ROOM_OCCUPANCY_EXPORT_MAX_ROWS || '10000', 10) || 10000, 100), 50000),
    inventoryExportMaxRows: Math.min(Math.max(parseInt(process.env.ROOM_INVENTORY_EXPORT_MAX_ROWS || '10000', 10) || 10000, 100), 50000),
  },
  maintenance: {
    exportMaxRows: Math.min(Math.max(parseInt(process.env.MAINTENANCE_EXPORT_MAX_ROWS || '10000', 10) || 10000, 100), 50000),
  },
  stock: {
    exportMaxRows: Math.min(Math.max(parseInt(process.env.STOCK_EXPORT_MAX_ROWS || '10000', 10) || 10000, 100), 50000),
    overviewMaxItems: Math.min(Math.max(parseInt(process.env.STOCK_OVERVIEW_MAX_ITEMS || '5000', 10) || 5000, 100), 20000),
  },
  employee: {
    listMaxRows: Math.min(Math.max(parseInt(process.env.EMPLOYEE_LIST_MAX_ROWS || '5000', 10) || 5000, 100), 20000),
    exportMaxRows: Math.min(Math.max(parseInt(process.env.EMPLOYEE_EXPORT_MAX_ROWS || '10000', 10) || 10000, 100), 50000),
  },
  security: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
    encryptionKey: process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'development_only_encryption_key',
  },
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
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
    ['VAPID_PUBLIC_KEY', config.push.publicKey],
    ['VAPID_PRIVATE_KEY', config.push.privateKey],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) throw new Error(`Eksik production ortam değişkenleri: ${missing.join(', ')}`);
  if (config.jwt.secret.length < 32 || config.cookie.secret.length < 32) {
    throw new Error('JWT_SECRET ve COOKIE_SECRET en az 32 karakter olmalıdır.');
  }
  if (config.security.encryptionKey.length < 32) throw new Error('DATA_ENCRYPTION_KEY en az 32 karakter olmalıdır.');
  const secrets = [config.jwt.secret, config.cookie.secret, config.security.encryptionKey];
  if (new Set(secrets).size !== secrets.length) throw new Error('JWT_SECRET, COOKIE_SECRET ve DATA_ENCRYPTION_KEY birbirinden farklı olmalıdır.');
  if (secrets.some((value) => /change[_-]?me|fallback|development|local_only/i.test(value))) {
    throw new Error('Production güvenlik anahtarlarında örnek veya geliştirme değeri kullanılamaz.');
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(config.cookie.name)) throw new Error('COOKIE_NAME değeri geçersiz.');
  for (const origin of config.cors.allowedOrigins) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error(`Geçersiz CORS origin değeri: ${origin}`); }
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) {
      throw new Error(`Production CORS origin yalnızca tam HTTPS origin olmalıdır: ${origin}`);
    }
  }
  if (!config.cors.allowedOrigins.includes(config.cors.clientUrl)) {
    throw new Error('CLIENT_URL, CORS_ALLOWED_ORIGINS listesinde bulunmalıdır.');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT değeri geçersiz.');
  if (!Number.isInteger(config.rateLimit.apiMax) || config.rateLimit.apiMax < 10) throw new Error('API_RATE_LIMIT_MAX değeri en az 10 olmalıdır.');
  if (!Number.isInteger(config.rateLimit.windowMs) || config.rateLimit.windowMs < 1000 || config.rateLimit.windowMs > 24 * 60 * 60 * 1000) {
    throw new Error('RATE_LIMIT_WINDOW_MS 1 saniye ile 24 saat arasında olmalıdır.');
  }
  if (!Number.isInteger(config.rateLimit.max) || config.rateLimit.max < 1 || config.rateLimit.max > config.rateLimit.apiMax) {
    throw new Error('RATE_LIMIT_MAX 1 ile API_RATE_LIMIT_MAX arasında olmalıdır.');
  }
  if (!Number.isInteger(config.security.saltRounds) || config.security.saltRounds < 10 || config.security.saltRounds > 14) {
    throw new Error('BCRYPT_SALT_ROUNDS 10-14 arasında olmalıdır.');
  }
  if (!Number.isFinite(config.cookie.maxAgeMs) || config.cookie.maxAgeMs < 60_000 || config.cookie.maxAgeMs > 31 * 24 * 60 * 60 * 1000) {
    throw new Error('COOKIE_MAX_AGE_DAYS 1 dakika ile 31 gün arasında olmalıdır.');
  }
}
