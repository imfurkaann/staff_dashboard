import { AppError } from '../middleware/errorHandler';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

const upperCasePattern = /[A-ZÇĞİÖŞÜ]/;
const lowerCasePattern = /[a-zçğıöşü]/;
const numberPattern = /\d/;
const specialCharacterPattern = /[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/;

export function validatePassword(value: unknown, label = 'Parola'): string {
  const password = typeof value === 'string' ? value : '';
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (
    password.length < PASSWORD_MIN_LENGTH
    || byteLength > PASSWORD_MAX_BYTES
    || !upperCasePattern.test(password)
    || !lowerCasePattern.test(password)
    || !numberPattern.test(password)
    || !specialCharacterPattern.test(password)
  ) {
    throw new AppError(
      `${label} en az ${PASSWORD_MIN_LENGTH} karakter; büyük harf, küçük harf, rakam ve özel karakter içermeli, UTF-8 olarak ${PASSWORD_MAX_BYTES} baytı aşmamalıdır.`,
      400,
    );
  }
  return password;
}

export function validateLoginPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new AppError('Kullanıcı adı veya şifre hatalı.', 401);
  }
  return value;
}
