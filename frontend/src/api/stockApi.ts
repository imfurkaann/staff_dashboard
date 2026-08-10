import { appConfig } from '../config/appConfig';

export type AssignmentStatus = 'HEALTHY' | 'MAINTENANCE_REQUIRED' | 'DAMAGED' | 'LOST' | 'IN_SERVICE' | 'REPLACEMENT_REQUIRED' | 'RETIRED';
export type MovementType = 'OPENING' | 'RECEIPT' | 'ADJUSTMENT' | 'ROOM_ASSIGNMENT' | 'ROOM_RETURN' | 'ROOM_TRANSFER' | 'STATUS_CHANGE' | 'REPLACEMENT' | 'RETIREMENT' | 'PERSONNEL_ASSIGNMENT' | 'PERSONNEL_RETURN';

export interface StockRoom {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  roomType?: string | null;
  block: { id: string; name: string };
}

export interface RoomAssignment {
  id: string;
  roomId: string;
  stockItemId: string;
  itemName: string;
  brand?: string | null;
  serialNo?: string | null;
  assetTag?: string | null;
  quantity: number;
  installedAt: string;
  returnedAt?: string | null;
  status: AssignmentStatus;
  notes?: string | null;
  room: StockRoom;
  maintenances?: Array<{ id: string; status: 'OPEN' | 'IN_PROGRESS' }>;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  type: MovementType;
  quantity: number;
  itemNameSnapshot: string;
  roomLabelSnapshot?: string | null;
  brand?: string | null;
  serialNo?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  stockItem: { itemCode?: string | null; unit: string };
  createdBy?: { fullName: string } | null;
  employee?: { firstName: string; lastName: string; registrationNo?: string | null } | null;
  maintenance?: { id: string; title: string; type: 'GENERAL' | 'ROOM_INVENTORY' } | null;
}

export interface PersonnelAssignment {
  id: string;
  stockItemId: string;
  itemName: string;
  itemCode?: string | null;
  assignedDate: string;
  status: string;
  notes?: string | null;
  employee: { id: string; firstName: string; lastName: string; registrationNo?: string | null; department: string };
}

export interface StockItem {
  id: string;
  itemName: string;
  itemCode?: string | null;
  category: string;
  itemType?: string;
  unit: string;
  specifications?: string | null;
  physicalStatus?: string;
  warrantyEndDate?: string | null;
  locationNote?: string | null;
  minimumStock: number;
  isActive: boolean;
  lastCountedAt?: string | null;
  totalStock: number;
  usedStock: number;
  usedInRooms: number;
  availableStock: number;
  serviceCount: number;
  issueCount: number;
  roomInventories: RoomAssignment[];
  inventories: PersonnelAssignment[];
  _count: { movements: number };
  createdAt: string;
  updatedAt: string;
}

export interface StockOverview {
  items: StockItem[];
  rooms: StockRoom[];
  movements: StockMovement[];
  summary: { totalRegistered: number; available: number; inRooms: number; inService: number; issues: number; criticalCards: number };
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${appConfig.apiBaseUrl}/stock${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Stok işlemi tamamlanamadı.');
  return data.data;
};

export const stockApi = {
  getOverview: () => request<StockOverview>(''),
  getNextItemCode: (category?: string) => request<{ itemCode: string }>(`/next-code${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  // Compatibility for employee/room detail selectors; all data still comes from the central stock overview.
  getStockItems: async () => (await request<StockOverview>('')).items,
  createStockItem: (payload: Partial<StockItem> & { itemName: string; totalStock?: number }) => request<StockItem>('', { method: 'POST', body: JSON.stringify(payload) }),
  updateStockItem: (id: string, payload: Partial<StockItem>) => request<StockItem>(`/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  receive: (id: string, payload: { quantity: number; reason?: string; notes?: string }) => request<StockItem>(`/${id}/receive`, { method: 'POST', body: JSON.stringify(payload) }),
  reconcileCount: (id: string, payload: { countedAvailable: number; notes?: string }) => request<{ item: StockItem; previousAvailable: number; countedAvailable: number; difference: number }>(`/${id}/reconcile-count`, { method: 'POST', body: JSON.stringify(payload) }),
  assignRoom: (id: string, payload: { roomId: string; quantity: number; brand?: string; serialNo?: string; notes?: string }) => request<RoomAssignment>(`/${id}/assign-room`, { method: 'POST', body: JSON.stringify(payload) }),
  assignRooms: (id: string, payload: { roomIds: string[]; quantityPerRoom: number; brand?: string; notes?: string }) => request<{ assignments: RoomAssignment[]; roomCount: number; totalQuantity: number }>(`/${id}/assign-rooms`, { method: 'POST', body: JSON.stringify(payload) }),
  returnAssignment: (id: string, payload: { outcome: 'RETURNED' | 'RETIRED'; notes?: string }) => request<RoomAssignment>(`/assignments/${id}/return`, { method: 'POST', body: JSON.stringify(payload) }),
  transferAssignment: (id: string, payload: { roomId: string; notes?: string }) => request<RoomAssignment>(`/assignments/${id}/transfer`, { method: 'POST', body: JSON.stringify(payload) }),
  updateAssignmentIdentity: (id: string, payload: { brand?: string; serialNo?: string; notes?: string }) => request<RoomAssignment>(`/assignments/${id}/identity`, { method: 'PATCH', body: JSON.stringify(payload) }),
  replaceAssignment: (id: string, payload: { brand?: string; serialNo?: string; notes?: string }) => request<RoomAssignment>(`/assignments/${id}/replace`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteStockItem: (id: string) => request<void>(`/${id}`, { method: 'DELETE' }),
  exportExcel: async () => {
    const response = await fetch(`${appConfig.apiBaseUrl}/stock/export.xlsx`, { credentials: 'include' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Excel raporu oluşturulamadı.');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'depo-stok-oda-zimmetleri.xlsx';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  },
};
