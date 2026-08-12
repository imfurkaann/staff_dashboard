import prisma from '../db/prisma';
import { randomBytes, randomInt } from 'crypto';

/**
 * Normalizes Turkish strings into standard ASCII slug (e.g., "Ahmet Can" "ÖZTÜRK" -> "ahmetcan", "ozturk")
 */
export function trToSlug(str: string): string {
  if (!str) return '';
  const trMap: Record<string, string> = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'I': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u',
  };

  return str
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (letter) => trMap[letter] || letter)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Generates a strictly unique username in the format: ad.soyad (or ad.soyad2, ad.soyad3...)
 */
export async function generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  const cleanFirst = trToSlug(firstName);
  const cleanLast = trToSlug(lastName);
  
  const baseUsername = `${cleanFirst}.${cleanLast}`.replace(/^\.|\.$/, '') || 'personel';
  
  let candidate = baseUsername;
  let counter = 1;
  
  while (true) {
    const existing = await prisma.user.findFirst({
      where: { username: candidate },
      select: { id: true },
    });
    
    if (!existing) {
      return candidate;
    }
    
    counter++;
    candidate = `${baseUsername}${counter}`;
  }
}

export async function generateUniqueEasyPassword(): Promise<string> {
  const randomPart = randomBytes(9).toString('base64url');
  const number = randomInt(1000, 10000);
  return `Lj!${number}-A${randomPart}a`;
}
