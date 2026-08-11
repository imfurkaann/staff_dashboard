import { EmployeeStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { EMPLOYEE_DEPARTMENTS } from '../utils/employeeDomain';

export const EMPLOYEE_GENDERS = new Set(['Male', 'Female']);
export const EMPLOYEE_FILTER_STATUSES = new Set(['ALL', ...Object.values(EmployeeStatus)]);

export function validateEmployeeFilterStatus(value: unknown): string {
  const status = value === undefined || value === '' ? 'ALL' : value;
  if (typeof status !== 'string' || !EMPLOYEE_FILTER_STATUSES.has(status)) throw new AppError('Geçersiz personel durumu filtresi.', 400);
  return status;
}

export function validateEmployeeGenderFilter(value: unknown): string {
  const gender = value === undefined || value === '' ? 'ALL' : value;
  if (typeof gender !== 'string' || (gender !== 'ALL' && !EMPLOYEE_GENDERS.has(gender))) throw new AppError('Geçersiz cinsiyet filtresi.', 400);
  return gender;
}

export function validateEmployeeDepartmentFilter(value: unknown): string {
  const department = value === undefined || value === '' ? 'ALL' : value;
  if (typeof department !== 'string' || (department !== 'ALL' && !(EMPLOYEE_DEPARTMENTS as readonly string[]).includes(department))) {
    throw new AppError('Geçersiz departman filtresi.', 400);
  }
  return department;
}

export function validateEmployeeId(value: unknown, label = 'Personel kimliği'): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(`${label} geçersiz.`, 400);
  }
  return value;
}
