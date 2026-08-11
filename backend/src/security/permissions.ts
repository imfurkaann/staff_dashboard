export const appRoles = [
  'ADMIN', 'HOUSING_MANAGER', 'HOUSING_STAFF', 'TECHNICAL_MANAGER', 'TECHNICIAN',
  'HOUSEKEEPING', 'WAREHOUSE_MANAGER', 'HR_MANAGER', 'SECURITY', 'STAFF',
] as const;

export type AppRole = typeof appRoles[number];

export const permissions = {
  DASHBOARD_VIEW: 'DASHBOARD_VIEW',
  EMPLOYEE_VIEW: 'EMPLOYEE_VIEW',
  EMPLOYEE_SENSITIVE_VIEW: 'EMPLOYEE_SENSITIVE_VIEW',
  EMPLOYEE_MANAGE: 'EMPLOYEE_MANAGE',
  EMPLOYEE_EXPORT: 'EMPLOYEE_EXPORT',
  ROOM_VIEW: 'ROOM_VIEW',
  ROOM_MANAGE: 'ROOM_MANAGE',
  ROOM_OCCUPANCY_EXPORT: 'ROOM_OCCUPANCY_EXPORT',
  ROOM_INVENTORY_MANAGE: 'ROOM_INVENTORY_MANAGE',
  CLEANING_MANAGE: 'CLEANING_MANAGE',
  CLEANING_DELETE: 'CLEANING_DELETE',
  MAINTENANCE_VIEW: 'MAINTENANCE_VIEW',
  MAINTENANCE_CREATE: 'MAINTENANCE_CREATE',
  MAINTENANCE_UPDATE: 'MAINTENANCE_UPDATE',
  MAINTENANCE_FULL_UPDATE: 'MAINTENANCE_FULL_UPDATE',
  MAINTENANCE_EXPORT: 'MAINTENANCE_EXPORT',
  VISITOR_VIEW: 'VISITOR_VIEW',
  VISITOR_MANAGE: 'VISITOR_MANAGE',
  VISITOR_ARCHIVE: 'VISITOR_ARCHIVE',
  VISITOR_EXPORT: 'VISITOR_EXPORT',
  STOCK_VIEW: 'STOCK_VIEW',
  STOCK_MANAGE: 'STOCK_MANAGE',
  STOCK_DEVICE_LIFECYCLE: 'STOCK_DEVICE_LIFECYCLE',
  SHARED_ASSET_VIEW: 'SHARED_ASSET_VIEW',
  SHARED_ASSET_MANAGE: 'SHARED_ASSET_MANAGE',
  NOTIFICATION_VIEW: 'NOTIFICATION_VIEW',
  NOTIFICATION_MANAGE: 'NOTIFICATION_MANAGE',
  NOTIFICATION_DELETE: 'NOTIFICATION_DELETE',
  TICKET_VIEW: 'TICKET_VIEW',
  TICKET_MANAGE: 'TICKET_MANAGE',
  TICKET_CREATE: 'TICKET_CREATE',
  USER_MANAGE: 'USER_MANAGE',
  PORTAL_SELF: 'PORTAL_SELF',
} as const;

export type Permission = typeof permissions[keyof typeof permissions];

const allPermissions = Object.values(permissions) as Permission[];

export const rolePermissions: Record<AppRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(allPermissions),
  HOUSING_MANAGER: new Set(allPermissions),
  HOUSING_STAFF: new Set([
    permissions.DASHBOARD_VIEW, permissions.EMPLOYEE_VIEW, permissions.ROOM_VIEW, permissions.ROOM_MANAGE,
    permissions.ROOM_OCCUPANCY_EXPORT, permissions.ROOM_INVENTORY_MANAGE, permissions.CLEANING_MANAGE,
    permissions.MAINTENANCE_VIEW, permissions.MAINTENANCE_CREATE, permissions.MAINTENANCE_UPDATE,
    permissions.MAINTENANCE_FULL_UPDATE, permissions.MAINTENANCE_EXPORT, permissions.VISITOR_VIEW, permissions.VISITOR_MANAGE,
    permissions.VISITOR_ARCHIVE, permissions.VISITOR_EXPORT, permissions.STOCK_VIEW, permissions.STOCK_MANAGE,
    permissions.STOCK_DEVICE_LIFECYCLE, permissions.SHARED_ASSET_VIEW, permissions.SHARED_ASSET_MANAGE,
    permissions.NOTIFICATION_VIEW, permissions.NOTIFICATION_MANAGE,
    permissions.TICKET_VIEW, permissions.TICKET_MANAGE,
  ]),
  TECHNICAL_MANAGER: new Set([
    permissions.DASHBOARD_VIEW, permissions.ROOM_VIEW, permissions.ROOM_INVENTORY_MANAGE,
    permissions.MAINTENANCE_VIEW, permissions.MAINTENANCE_CREATE, permissions.MAINTENANCE_UPDATE,
    permissions.MAINTENANCE_FULL_UPDATE, permissions.MAINTENANCE_EXPORT, permissions.STOCK_VIEW,
    permissions.STOCK_DEVICE_LIFECYCLE, permissions.SHARED_ASSET_VIEW,
  ]),
  TECHNICIAN: new Set([
    permissions.ROOM_VIEW, permissions.MAINTENANCE_VIEW, permissions.MAINTENANCE_CREATE,
    permissions.MAINTENANCE_UPDATE,
  ]),
  HOUSEKEEPING: new Set([permissions.ROOM_VIEW, permissions.CLEANING_MANAGE]),
  WAREHOUSE_MANAGER: new Set([
    permissions.DASHBOARD_VIEW, permissions.ROOM_VIEW, permissions.STOCK_VIEW, permissions.STOCK_MANAGE,
    permissions.STOCK_DEVICE_LIFECYCLE, permissions.SHARED_ASSET_VIEW, permissions.SHARED_ASSET_MANAGE,
    permissions.MAINTENANCE_VIEW,
  ]),
  HR_MANAGER: new Set([
    permissions.DASHBOARD_VIEW, permissions.EMPLOYEE_VIEW, permissions.EMPLOYEE_SENSITIVE_VIEW,
    permissions.EMPLOYEE_EXPORT, permissions.ROOM_VIEW, permissions.ROOM_OCCUPANCY_EXPORT,
    permissions.NOTIFICATION_VIEW, permissions.NOTIFICATION_MANAGE, permissions.TICKET_VIEW,
  ]),
  SECURITY: new Set([
    permissions.DASHBOARD_VIEW, permissions.EMPLOYEE_VIEW, permissions.ROOM_VIEW, permissions.MAINTENANCE_VIEW,
    permissions.MAINTENANCE_CREATE, permissions.VISITOR_VIEW, permissions.VISITOR_MANAGE,
    permissions.SHARED_ASSET_VIEW, permissions.NOTIFICATION_VIEW, permissions.NOTIFICATION_MANAGE,
    permissions.TICKET_VIEW,
  ]),
  STAFF: new Set([permissions.PORTAL_SELF, permissions.SHARED_ASSET_VIEW, permissions.TICKET_CREATE]),
};

export const isAppRole = (role: unknown): role is AppRole => typeof role === 'string' && (appRoles as readonly string[]).includes(role);
export const hasPermission = (role: string | undefined, permission: Permission) => isAppRole(role) && rolePermissions[role].has(permission);
export const hasAnyPermission = (role: string | undefined, required: Permission[]) => required.some((permission) => hasPermission(role, permission));
export const hasAllPermissions = (role: string | undefined, required: Permission[]) => required.every((permission) => hasPermission(role, permission));

export const roleLabels: Record<AppRole, string> = {
  ADMIN: 'Sistem Yöneticisi',
  HOUSING_MANAGER: 'Lojman Müdürü',
  HOUSING_STAFF: 'Lojman Çalışanı',
  TECHNICAL_MANAGER: 'Teknik Müdür',
  TECHNICIAN: 'Teknik Çalışan',
  HOUSEKEEPING: 'Kat Hizmetleri Personeli',
  WAREHOUSE_MANAGER: 'Depo Sorumlusu',
  HR_MANAGER: 'İnsan Kaynakları Yetkilisi',
  SECURITY: 'Güvenlik Personeli',
  STAFF: 'Personel Portal Kullanıcısı',
};
