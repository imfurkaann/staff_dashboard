import { hasPermission, permissions } from './permissions';

const sensitiveEmployeeFields = new Set([
  'tcNo', 'tcNoHash', 'tcNoMasked', 'phone', 'vehiclePlate', 'ageGroup', 'languageNationality',
  'emergencyContactName', 'emergencyRelation', 'emergencyContactPhone', 'isSmoker',
  'hasSnoring', 'disciplinaryNotes', 'user', 'userId',
]);
const sensitiveEmployeeRelations = new Set(['inventories', 'occupancies']);

// Lojman operasyonunu yürüten kullanıcılar zimmet, konaklama ve disiplin kaydını
// görmelidir; ancak iletişim ve kişisel profil alanları görünür olmamalıdır.
const privateEmployeeFields = new Set([
  'tcNo', 'tcNoHash', 'tcNoMasked', 'phone', 'vehiclePlate', 'ageGroup', 'languageNationality',
  'emergencyContactName', 'emergencyRelation', 'emergencyContactPhone', 'isSmoker',
  'hasSnoring', 'user', 'userId',
]);

function stripSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveEmployeeFields.has(key) && !sensitiveEmployeeRelations.has(key))
      .map(([key, nested]) => [key, stripSensitiveFields(nested)]),
  );
}

function stripPrivateFieldsKeepOperationalHistory(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripPrivateFieldsKeepOperationalHistory);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !privateEmployeeFields.has(key))
      .map(([key, nested]) => [key, stripPrivateFieldsKeepOperationalHistory(nested)]),
  );
}

export function scopeEmployeeData<T>(value: T, role?: string): T {
  if (hasPermission(role, permissions.EMPLOYEE_SENSITIVE_VIEW)) return value;
  if (hasPermission(role, permissions.EMPLOYEE_MANAGE)) {
    return stripPrivateFieldsKeepOperationalHistory(value) as T;
  }
  return stripSensitiveFields(value) as T;
}

const retiredMaintenanceServiceFields = new Set([
  'serviceProvider', 'serviceReference', 'laborCost', 'partsCost',
  'sentToServiceAt', 'returnedFromServiceAt',
  'inventorySerialNoSnapshot', 'inventoryAssetTagSnapshot', 'serialNo', 'assetTag',
]);

export function scopeMaintenanceData<T>(value: T, _role?: string): T {
  const visit = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== 'object' || current instanceof Date) return current;
    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>)
        .filter(([key]) => !retiredMaintenanceServiceFields.has(key))
        .map(([key, nested]) => [key, visit(nested)]),
    );
  };
  return visit(value) as T;
}

function minimalBed(bed: Record<string, unknown>) {
  return { id: bed.id, bedLabel: bed.bedLabel, isOccupied: bed.isOccupied };
}

export function scopeRoomData<T>(value: T, role?: string): T {
  if (['ADMIN', 'HOUSING_MANAGER'].includes(role || '')) return value;
  const isHousingStaff = role === 'HOUSING_STAFF';
  const isHumanResources = role === 'HR_MANAGER';
  const mayViewInventory = hasPermission(role, permissions.ROOM_INVENTORY_MANAGE) || hasPermission(role, permissions.STOCK_VIEW);
  const mayViewMaintenance = hasPermission(role, permissions.MAINTENANCE_VIEW);
  const mayViewCleaning = hasPermission(role, permissions.CLEANING_MANAGE);

  const visit = (current: unknown, key?: string): unknown => {
    if (Array.isArray(current)) return current.map((item) => visit(item, key));
    if (!current || typeof current !== 'object' || current instanceof Date) return current;
    if (key === 'currentEmployee' || key === 'employee') {
      if (isHumanResources) return current;
      if (!isHousingStaff) return null;
      return stripSensitiveFields(current);
    }

    const source = current as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(source)) {
      if (sensitiveEmployeeFields.has(childKey)) continue;
      if (childKey === 'occupancies' && !isHousingStaff && !isHumanResources) { result[childKey] = []; continue; }
      if (childKey === 'beds' && !isHousingStaff && !isHumanResources) {
        result[childKey] = Array.isArray(childValue) ? childValue.map((bed) => minimalBed(bed as Record<string, unknown>)) : [];
        continue;
      }
      if ((childKey === 'roomInventories' || childKey === 'inventories') && !mayViewInventory) { result[childKey] = []; continue; }
      if (childKey === 'maintenances' && !mayViewMaintenance) { result[childKey] = []; continue; }
      if (retiredMaintenanceServiceFields.has(childKey)) continue;
      if (childKey === 'cleaningLogs' && !mayViewCleaning) { result[childKey] = []; continue; }
      result[childKey] = visit(childValue, childKey);
    }
    return result;
  };

  return visit(value) as T;
}
