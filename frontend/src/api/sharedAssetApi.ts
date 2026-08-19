import { appConfig } from '../config/appConfig';

export type SharedAssetStatus = 'AVAILABLE' | 'LOANED' | 'MAINTENANCE' | 'RETIRED';

export interface SharedAssetLog {
  id: string;
  assetId: string;
  asset?: SharedAsset;
  action: string;
  assetCodeSnapshot: string;
  assetNameSnapshot: string;
  holderType?: 'EMPLOYEE' | 'ROOM' | 'OTHER' | null;
  statusFrom?: SharedAssetStatus | null;
  statusTo?: SharedAssetStatus | null;
  borrowerName?: string | null;
  employeeId?: string | null;
  roomId?: string | null;
  borrowedAt?: string | null;
  returnedAt?: string | null;
  expectedReturnDate?: string | null;
  notes?: string | null;
  createdBy?: { id: string; fullName: string } | null;
  createdAt: string;
}

export interface SharedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  category: string;
  brandModel?: string | null;
  serialNo?: string | null;
  status: SharedAssetStatus;
  currentHolderType?: 'EMPLOYEE' | 'ROOM' | null;
  currentEmployeeId?: string | null;
  currentEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
    registrationNo?: string | null;
    department?: string | null;
  } | null;
  currentRoomId?: string | null;
  currentPersonnelInventoryId?: string | null;
  currentRoomInventoryId?: string | null;
  stockItemId?: string | null;
  currentRoom?: {
    id: string;
    roomNumber: string;
    floor: number;
    roomType?: string | null;
    block: { name: string };
  } | null;
  borrowedAt?: string | null;
  expectedReturnDate?: string | null;
  warrantyEndDate?: string | null;
  locationNote?: string | null;
  notes?: string | null;
  logs?: SharedAssetLog[];
  createdAt: string;
  updatedAt: string;
}

export interface SharedAssetLogList {
  items: SharedAssetLog[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface SharedAssetOverview {
  assets: SharedAsset[];
  logs?: SharedAssetLog[];
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    registrationNo?: string | null;
    department: string;
  }>;
  rooms: Array<{
    id: string;
    roomNumber: string;
    floor: number;
    block: { name: string };
  }>;
  summary: {
    totalRegistered: number;
    available: number;
    loaned: number;
    maintenance: number;
    retired: number;
  };
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${appConfig.apiBaseUrl}/shared-assets${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Ortak eşya işlemi tamamlanamadı.');
  return data.data;
};

export const sharedAssetApi = {
  getOverview: () => request<SharedAssetOverview>(''),
  getLogs: (params: { search?: string; assetId?: string; action?: string; holderType?: string; dateStart?: string; dateEnd?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    return request<SharedAssetLogList>(`/logs?${query.toString()}`);
  },
  createAsset: (payload: Partial<SharedAsset> & { stockItemId: string }, key?: string) => request<SharedAsset>('', { method: 'POST', body: JSON.stringify(payload), headers: key ? { 'X-Idempotency-Key': key } : undefined }),
  checkOutAsset: (id: string, payload: { holderType: 'EMPLOYEE' | 'ROOM' | 'OTHER'; employeeId?: string; customBorrowerName?: string; roomId?: string; expectedReturnDate?: string; notes?: string }, key?: string) =>
    request<SharedAsset>(`/${id}/check-out`, { method: 'POST', body: JSON.stringify(payload), headers: key ? { 'X-Idempotency-Key': key } : undefined }),
  checkInAsset: (id: string, payload: { locationNote?: string; notes: string; newStatus?: SharedAssetStatus }, key?: string) =>
    request<SharedAsset>(`/${id}/check-in`, { method: 'POST', body: JSON.stringify(payload), headers: key ? { 'X-Idempotency-Key': key } : undefined }),
  updateStatus: (id: string, payload: { status: SharedAssetStatus; locationNote?: string; notes?: string }, key?: string) =>
    request<SharedAsset>(`/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload), headers: key ? { 'X-Idempotency-Key': key } : undefined }),
  addMaintenanceLog: (id: string, payload: { action: 'MAINTENANCE_START' | 'MAINTENANCE_END' | 'FAULT_REPORTED' | 'REPAIR_COMPLETED'; notes: string }, key?: string) =>
    request<SharedAsset>(`/${id}/maintenance`, { method: 'POST', body: JSON.stringify(payload), headers: key ? { 'X-Idempotency-Key': key } : undefined }),
  deleteLog: (logId: string) => request<void>(`/logs/${logId}`, { method: 'DELETE' }),
  updateLog: (logId: string, payload: { borrowerName?: string; notes?: string }) =>
    request<SharedAssetLog>(`/logs/${logId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
};
