import { AppError } from '../middleware/errorHandler';

export const EMPLOYEE_DEPARTMENTS = [
  'ÖN BÜRO', 'REZERVASYON', 'MİSAFİR İLİŞKİLERİ', 'KAT HİZMETLERİ',
  'YİYECEK VE İÇECEK', 'MUTFAK', 'TEKNİK SERVİS', 'GÜVENLİK',
  'İNSAN KAYNAKLARI', 'MUHASEBE VE FİNANS', 'SATIŞ VE PAZARLAMA',
  'SATIN ALMA', 'DEPO', 'BİLGİ İŞLEM', 'ÇAMAŞIRHANE', 'SPA',
  'ANİMASYON', 'BAHÇE VE PEYZAJ', 'İDARİ İŞLER',
] as const;

export const EMPLOYEE_TITLES = [
  'PERSONEL', 'YÖNETİCİ', 'MÜDÜR', 'MÜDÜR YARDIMCISI', 'ŞEF',
  'SORUMLU', 'UZMAN', 'TEKNİSYEN', 'STAJYER', 'SEZONLUK PERSONEL', 'TAŞERON PERSONEL',
] as const;

export const SHIFT_TYPES = [
  '08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00', '13:00 - 21:00',
  'DÖNÜŞÜMLÜ VARDİYA',
] as const;

export function canonicalShift(value: string | null | undefined): string | null {
  const clean = value?.trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const comparisonKey = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US');
  const legacyShifts: Record<string, string> = {
    gunduz: '08:00 - 16:00',
    gece: '00:00 - 08:00',
    donusumlu: 'DÖNÜŞÜMLÜ VARDİYA',
    '01:00 - 09:00': '13:00 - 21:00',
    '01:00-09:00': '13:00 - 21:00',
  };
  const legacy = legacyShifts[comparisonKey(clean)];
  if (legacy) return legacy;
  const preset = SHIFT_TYPES.find((choice) => comparisonKey(choice) === comparisonKey(clean));
  if (preset) return preset;
  const match = clean.match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new AppError('Vardiya saatleri 00:00 - 23:59 biçiminde geçerli bir aralık olmalıdır.', 400);
  if (`${match[1]}:${match[2]}` === `${match[3]}:${match[4]}`) throw new AppError('Vardiya başlangıç ve bitiş saati aynı olamaz.', 400);
  return `${match[1]}:${match[2]} - ${match[3]}:${match[4]}`;
}
export const AGE_GROUPS = ['18-25 Yaş (Genç)', '26-40 Yaş (Orta Yaş)', '41-55 Yaş (Deneyimli)', '56+ Yaş (Kıdemli)'] as const;
export const LANGUAGE_NATIONALITIES = ['Türkçe (T.C.)', 'İngilizce', 'Rusça', 'Arapça', 'Farsça', 'Kırgızca / Özbekçe / Kazakça', 'Diğer'] as const;
export const EMERGENCY_RELATIONS = ['Eşi', 'Babası', 'Annesi', 'Çocuğu', 'Kardeşi', 'Akrabası', 'Arkadaşı', 'Diğer'] as const;

export function canonicalChoice(value: string | null | undefined, choices: readonly string[], fieldName: string, required = false): string | null {
  const clean = value?.trim().replace(/\s+/g, ' ');
  if (!clean) {
    if (required) throw new AppError(`${fieldName} zorunludur.`, 400);
    return null;
  }
  const comparisonKey = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US');
  const cleanKey = comparisonKey(clean);
  const match = choices.find((choice) => comparisonKey(choice) === cleanKey);
  if (!match) throw new AppError(`Geçersiz ${fieldName.toLocaleLowerCase('tr-TR')} seçimi.`, 400);
  return match;
}
