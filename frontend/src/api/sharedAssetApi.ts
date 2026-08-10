import { appConfig } from '../config/appConfig';

export type SharedAssetStatus = 'AVAILABLE' | 'LOANED' | 'MAINTENANCE' | 'RETIRED';

export interface SharedAssetLog {
  id: string;
  assetId: string;
  asset?: SharedAsset;
  action: string;
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
  currentRoom?: {
    id: string;
    roomNumber: string;
    floor: number;
    block: { name: string };
  } | null;
  borrowedAt?: string | null;
  expectedReturnDate?: string | null;
  warrantyEndDate?: string | null;
  locationNote?: string | null;
  notes?: string | null;
  logs: SharedAssetLog[];
  createdAt: string;
  updatedAt: string;
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
  createAsset: (payload: Partial<SharedAsset> & { assetName: string }) => request<SharedAsset>('', { method: 'POST', body: JSON.stringify(payload) }),
  checkOutAsset: (id: string, payload: { holderType?: 'EMPLOYEE' | 'ROOM'; employeeId?: string; customBorrowerName?: string; roomId?: string; expectedReturnDate?: string; notes?: string }) =>
    request<SharedAsset>(`/${id}/check-out`, { method: 'POST', body: JSON.stringify(payload) }),
  checkInAsset: (id: string, payload: { locationNote?: string; notes?: string; newStatus?: SharedAssetStatus }) =>
    request<SharedAsset>(`/${id}/check-in`, { method: 'POST', body: JSON.stringify(payload) }),
  updateStatus: (id: string, payload: { status: SharedAssetStatus; locationNote?: string; notes?: string }) =>
    request<SharedAsset>(`/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),
  addMaintenanceLog: (id: string, payload: { action: 'MAINTENANCE_START' | 'MAINTENANCE_END' | 'FAULT_REPORTED' | 'REPAIR_COMPLETED'; notes: string; newStatus?: SharedAssetStatus }) =>
    request<SharedAsset>(`/${id}/maintenance`, { method: 'POST', body: JSON.stringify(payload) }),
};
