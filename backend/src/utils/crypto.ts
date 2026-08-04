import crypto from 'crypto';
import { config } from '../config';

// 256-bit Key derived from JWT_SECRET or ENV
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(config.security.encryptionKey)
  .digest(); // 32 bytes key

/**
 * Encrypts sensitive text (e.g. TC Kimlik No) using AES-256-GCM
 */
export function encryptSensitiveData(text?: string | null): string | null {
  if (!text || !text.trim()) return null;

  const iv = crypto.randomBytes(12); // 12 bytes IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(text.trim(), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  // Format: IV:AuthTag:EncryptedText
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts encrypted sensitive text
 */
export function decryptSensitiveData(encryptedData?: string | null): string | null {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData || null;

  try {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // If it was stored in plaintext previously, return as is
    return encryptedData;
  }
}

export function hashSensitiveData(text: string): string {
  return crypto.createHmac('sha256', ENCRYPTION_KEY).update(text.trim()).digest('hex');
}

/**
 * Masks TC Number for UI display
 * E.g. "10293847561" -> "102******61"
 */
export function maskTcNo(tcNo?: string | null): string | null {
  if (!tcNo) return null;
  
  // Decrypt if encrypted first
  const plainTc = decryptSensitiveData(tcNo);
  if (!plainTc || plainTc.length < 6) return plainTc;
  
  return `${plainTc.slice(0, 3)}******${plainTc.slice(-2)}`;
}
