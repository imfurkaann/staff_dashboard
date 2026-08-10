import { appConfig } from '../config/appConfig';
import { AppRole } from '../security/accessControl';

export interface ManagedUser {
  id: string; username: string; email: string; fullName: string; role: AppRole; isActive: boolean;
  lastLoginAt?: string | null; createdAt: string; updatedAt: string;
  employee?: { id: string; registrationNo?: string | null; firstName: string; lastName: string; department: string; title?: string | null } | null;
  userAuditHistory: Array<{ id: string; action: string; beforeRole?: AppRole | null; afterRole?: AppRole | null; notes?: string | null; createdAt: string; actorUser?: { fullName: string } | null }>;
}

const request = async <T>(path = '', init?: RequestInit): Promise<T> => {
  const response = await fetch(`${appConfig.apiBaseUrl}/users${path}`, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Kullanıcı işlemi tamamlanamadı.');
  return payload.data;
};

export const userManagementApi = {
  list: () => request<ManagedUser[]>(),
  create: (data: { username: string; email: string; fullName: string; role: AppRole; password: string }) => request<ManagedUser>('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { email?: string; fullName?: string; role?: AppRole; isActive?: boolean }) => request<ManagedUser>(`/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetPassword: (id: string, password: string) => request<void>(`/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
};
