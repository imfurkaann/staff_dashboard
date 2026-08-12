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

export const roleDescriptions: Record<AppRole, string> = {
  ADMIN: 'Sistem yapılandırması, kullanıcı yönetimi ve bütün operasyon modüllerinde tam yetki.',
  HOUSING_MANAGER: 'Kullanıcı yönetimi dahil lojman operasyonları ve yönetim süreçlerinde tam yetki.',
  HOUSING_STAFF: 'Lojman operasyonları; hassas personel verileri ve kullanıcı yönetimi hariç.',
  TECHNICAL_MANAGER: 'Arıza süreçleri, teknik raporlar, cihaz yaşam döngüsü ve stok görünümü.',
  TECHNICIAN: 'Oda ve arızalarda bildirim, işlem ve çözüm güncelleme yetkisi.',
  HOUSEKEEPING: 'Oda görünümü ile temizlik süreçleriyle sınırlı erişim.',
  WAREHOUSE_MANAGER: 'Depo, stok, zimmet ve ortak eşya işlemleri.',
  HR_MANAGER: 'Hassas personel bilgileri, personel raporları ve ilgili yönetim görünümleri.',
  SECURITY: 'Ziyaretçi süreçleri, temel oda/personel görünümü ve arıza bildirimi.',
  STAFF: 'Yalnızca bağlı personelin kendi portal verileri, talepleri ve ortak eşya görünümü.',
};

export const permissionLabels: Record<Permission, string> = {
  DASHBOARD_VIEW: 'Dashboard görüntüleme',
  EMPLOYEE_VIEW: 'Personel listesi görüntüleme',
  EMPLOYEE_SENSITIVE_VIEW: 'Hassas personel verilerini görüntüleme',
  EMPLOYEE_MANAGE: 'Personel kayıtlarını yönetme',
  EMPLOYEE_EXPORT: 'Personel raporu dışa aktarma',
  ROOM_VIEW: 'Oda bilgilerini görüntüleme',
  ROOM_MANAGE: 'Oda kayıtlarını yönetme',
  ROOM_OCCUPANCY_EXPORT: 'Oda doluluk raporu dışa aktarma',
  ROOM_INVENTORY_MANAGE: 'Oda envanterini yönetme',
  CLEANING_MANAGE: 'Temizlik süreçlerini yönetme',
  CLEANING_DELETE: 'Temizlik kaydını silme',
  MAINTENANCE_VIEW: 'Arıza kayıtlarını görüntüleme',
  MAINTENANCE_CREATE: 'Arıza kaydı oluşturma',
  MAINTENANCE_UPDATE: 'Arıza sürecini güncelleme',
  MAINTENANCE_FULL_UPDATE: 'Arıza servis ve maliyet bilgilerini yönetme',
  MAINTENANCE_EXPORT: 'Arıza raporu dışa aktarma',
  VISITOR_VIEW: 'Ziyaretçi kayıtlarını görüntüleme',
  VISITOR_MANAGE: 'Ziyaretçi giriş/çıkışını yönetme',
  VISITOR_ARCHIVE: 'Ziyaretçi kaydını arşivleme/geri alma',
  VISITOR_EXPORT: 'Ziyaretçi raporu dışa aktarma',
  STOCK_VIEW: 'Stok ve hareketleri görüntüleme',
  STOCK_MANAGE: 'Stok kayıtlarını yönetme',
  STOCK_DEVICE_LIFECYCLE: 'Cihaz zimmet yaşam döngüsünü yönetme',
  SHARED_ASSET_VIEW: 'Ortak eşyaları görüntüleme',
  SHARED_ASSET_MANAGE: 'Ortak eşya işlemlerini yönetme',
  NOTIFICATION_VIEW: 'Duyuruları görüntüleme',
  NOTIFICATION_MANAGE: 'Duyuru gönderme',
  NOTIFICATION_DELETE: 'Duyuru silme',
  TICKET_VIEW: 'Talep ve şikâyetleri görüntüleme',
  TICKET_MANAGE: 'Talep ve şikâyetleri yönetme',
  TICKET_CREATE: 'Talep ve şikâyet oluşturma',
  USER_MANAGE: 'Kullanıcı ve rol yönetimi',
  PORTAL_SELF: 'Kendi personel portalına erişim',
};

export const roleCatalog = appRoles.map((role) => ({
  role,
  label: roleLabels[role],
  description: roleDescriptions[role],
  permissions: Array.from(rolePermissions[role]).map((permission) => ({
    permission,
    label: permissionLabels[permission],
  })),
}));
