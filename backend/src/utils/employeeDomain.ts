import { AppError } from '../middleware/errorHandler';

export const EMPLOYEE_DEPARTMENTS = [
  'İnşaat / Saha', 'İdari İşler', 'Güvenlik', 'Mutfak / Restoran',
  'Kat Hizmetleri / Temizlik', 'Teknik Servis / Bakım', 'Bilgi İşlem / IT',
  'Lojistik / Depo', 'Diğer',
] as const;

export const EMPLOYEE_TITLES = [
  'Mühendis', 'Mimar', 'Şantiye Formeni', 'Usta / Teknik Eleman',
  'Saha İşçisi / Personel', 'Güvenlik Görevlisi', 'Kat Hizmetlisi / Temizlikçi',
  'Aşçı / Mutfak Personeli', 'Şoför', 'Depo / Lojistik Görevlisi',
  'İK / İdari Personel', 'Diğer',
] as const;

export const SHIFT_TYPES = ['Gündüz', 'Gece', 'Dönüşümlü'] as const;
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
