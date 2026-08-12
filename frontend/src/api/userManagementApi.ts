import { appConfig } from '../config/appConfig';
import { AppRole, UiPermission } from '../security/accessControl';

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    registrationNo?: string | null;
    firstName: string;
    lastName: string;
    department: string;
    title?: string | null;
    isDeleted: boolean;
  } | null;
}

export interface UserAuditEntry {
  id: string;
  action: string;
  beforeRole?: AppRole | null;
  afterRole?: AppRole | null;
  notes?: string | null;
  createdAt: string;
  actorUser?: { id: string; fullName: string; username: string } | null;
}

export interface ManagedUserDetail extends ManagedUser {
  userAuditHistory: UserAuditEntry[];
}

export interface UserListResult {
  items: ManagedUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RoleCatalogItem {
  role: AppRole;
  label: string;
  description: string;
  permissions: Array<{ permission: UiPermission; label: string }>;
}

export interface UserListParams {
  search?: string;
  role?: AppRole | 'ALL';
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  page?: number;
  pageSize?: number;
}

const request = async <T>(path = '', init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${appConfig.apiBaseUrl}/users${path}`, {
      credentials: 'include',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new Error('Sunucuya bağlanılamadı. Ağ bağlantınızı kontrol edip tekrar deneyin.');
  }

  const raw = await response.text();
  let payload: { data?: T; message?: string } = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as { data?: T; message?: string };
    } catch {
      throw new Error('Sunucudan geçersiz bir yanıt alındı.');
    }
  }
  if (!response.ok) throw new Error(payload.message || 'Kullanıcı işlemi tamamlanamadı.');
  return payload.data as T;
};

function listQuery(params: UserListParams): string {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.role && params.role !== 'ALL') query.set('role', params.role);
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const value = query.toString();
  return value ? `?${value}` : '';
}

export const userManagementApi = {
  list: (params: UserListParams = {}) => request<UserListResult>(listQuery(params)),
  roles: () => request<RoleCatalogItem[]>('/roles'),
  get: (id: string) => request<ManagedUserDetail>(`/${encodeURIComponent(id)}`),
  create: (data: { username: string; email: string; fullName: string; role: AppRole; password: string }) =>
    request<ManagedUserDetail>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { email?: string; fullName?: string; role?: AppRole; isActive?: boolean }) =>
    request<ManagedUserDetail>(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetPassword: (id: string, password: string) =>
    request<void>(`/${encodeURIComponent(id)}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
};
