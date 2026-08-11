import { hasPermission, permissions } from './permissions';

const sensitiveEmployeeFields = new Set([
  'tcNo', 'tcNoHash', 'tcNoMasked', 'phone', 'vehiclePlate', 'ageGroup', 'languageNationality',
  'emergencyContactName', 'emergencyRelation', 'emergencyContactPhone', 'photoUrl', 'isSmoker',
  'hasSnoring', 'disciplinaryNotes', 'user', 'userId',
]);
const sensitiveEmployeeRelations = new Set(['inventories', 'occupancies']);

function stripSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveEmployeeFields.has(key) && !sensitiveEmployeeRelations.has(key))
      .map(([key, nested]) => [key, stripSensitiveFields(nested)]),
  );
}

export function scopeEmployeeData<T>(value: T, role?: string): T {
  if (hasPermission(role, permissions.EMPLOYEE_SENSITIVE_VIEW)) return value;
  return stripSensitiveFields(value) as T;
}

const sensitiveMaintenanceFinancialFields = new Set(['laborCost', 'partsCost']);

export function scopeMaintenanceData<T>(value: T, role?: string): T {
  if (hasPermission(role, permissions.MAINTENANCE_FULL_UPDATE)) return value;
  const visit = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== 'object' || current instanceof Date) return current;
    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>)
        .filter(([key]) => !sensitiveMaintenanceFinancialFields.has(key))
        .map(([key, nested]) => [key, visit(nested)]),
    );
  };
  return visit(value) as T;
}

function minimalBed(bed: Record<string, unknown>) {
  return { id: bed.id, bedLabel: bed.bedLabel, isOccupied: bed.isOccupied };
}

export function scopeRoomData<T>(value: T, role?: string): T {
  if (['ADMIN', 'HOUSING_MANAGER', 'HR_MANAGER'].includes(role || '')) return value;
  const isHousingStaff = role === 'HOUSING_STAFF';
  const isHousekeeping = role === 'HOUSEKEEPING';
  const isTechnical = role === 'TECHNICIAN' || role === 'TECHNICAL_MANAGER';
  const isWarehouse = role === 'WAREHOUSE_MANAGER';

  const visit = (current: unknown, key?: string): unknown => {
    if (Array.isArray(current)) return current.map((item) => visit(item, key));
    if (!current || typeof current !== 'object' || current instanceof Date) return current;
    if (key === 'currentEmployee' || key === 'employee') {
      if (!isHousingStaff) return null;
      return stripSensitiveFields(current);
    }

    const source = current as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(source)) {
      if (sensitiveEmployeeFields.has(childKey)) continue;
      if (childKey === 'occupancies' && !isHousingStaff) { result[childKey] = []; continue; }
      if (childKey === 'beds' && !isHousingStaff) {
        result[childKey] = Array.isArray(childValue) ? childValue.map((bed) => minimalBed(bed as Record<string, unknown>)) : [];
        continue;
      }
      if ((childKey === 'roomInventories' || childKey === 'inventories') && isHousekeeping) { result[childKey] = []; continue; }
      if (childKey === 'maintenances' && (isHousekeeping || isWarehouse)) { result[childKey] = []; continue; }
      if (sensitiveMaintenanceFinancialFields.has(childKey) && !hasPermission(role, permissions.MAINTENANCE_FULL_UPDATE)) continue;
      if (childKey === 'cleaningLogs' && (isTechnical || isWarehouse || role === 'SECURITY')) { result[childKey] = []; continue; }
      result[childKey] = visit(childValue, childKey);
    }
    return result;
  };

  return visit(value) as T;
}
