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
