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

/**
 * Generates a simple, easy-to-type, yet unique password for an employee (e.g. Lojman749! or Staff832!)
 */
export async function generateUniqueEasyPassword(): Promise<string> {
  const prefixes = ['Lojman', 'Staff', 'Oda', 'Personel'];
  const prefix = prefixes[randomInt(prefixes.length)];
  return `${prefix}!${randomBytes(8).toString('hex')}${randomInt(10)}`;
}
