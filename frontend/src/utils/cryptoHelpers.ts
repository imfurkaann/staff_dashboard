/**
 * Client-side mask/decrypt helper for sensitive fields
 */
export function decryptSensitiveData(encryptedText?: string | null): string | null {
  if (!encryptedText) return null;
  // If text contains encryption delimiters (IV:Tag:Data), return placeholder or handled text
  if (encryptedText.includes(':')) {
    return '***-***-***';
  }
  return encryptedText;
}

/**
 * Safe UUID v4 generator working in both secure (HTTPS/localhost) and non-secure (HTTP IP) contexts
 */
export function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

