import axios from 'axios';
import { appConfig } from '../config/appConfig';

export type RoomStatusType = 'READY' | 'NEEDS_CLEANING' | 'OUT_OF_ORDER';

export interface RoomEmployee {
  id: string;
  registrationNo?: string;
  firstName: string;
  lastName: string;
  gender: string;
  department: string;
  title?: string;
  company?: string;
  isSmoker?: boolean;
  hasSnoring?: boolean;
  phone?: string;
  photoUrl?: string;
  status: string;
  shiftType?: string;
  createdAt: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  inventories?: any[];
}

export interface RoomBed {
  id: string;
  bedLabel: string;
  isOccupied: boolean;
  currentEmployee?: RoomEmployee | null;
}

export interface RoomMaintenance {
  id: string;
  type: 'GENERAL' | 'ROOM_INVENTORY';
  roomInventoryId?: string | null;
  inventoryStatus?: RoomInventoryStatus | null;
  inventoryItemNameSnapshot?: string | null;
  inventoryBrandSnapshot?: string | null;
  inventorySerialNoSnapshot?: string | null;
  inventoryQuantitySnapshot?: number | null;
  title: string;
  description?: string;
  priority: string;
  status: string;
  category?: string | null;
  location?: string | null;
  reportedBy: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

export type RoomInventoryStatus = 'HEALTHY' | 'MAINTENANCE_REQUIRED' | 'DAMAGED' | 'LOST' | 'IN_SERVICE' | 'REPLACEMENT_REQUIRED' | 'RETIRED';
export interface RoomInventory {
  id: string;
  roomId: string;
  itemName: string;
  brand?: string | null;
  serialNo?: string | null;
  assetTag?: string | null;
  quantity: number;
  installedAt: string;
  status: RoomInventoryStatus;
  notes?: string | null;
  returnedAt?: string | null;
  stockItemId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomOccupancyHistory {
  id: string;
  bedId: string;
  bedLabel: string;
  employee: RoomEmployee;
  checkInDate: string;
  checkOutDate?: string | null;
  transferReason?: string | null;
}

export interface RoomBlockInfo {
  id: string;
  name: string;
  genderPolicy: string;
}

export interface RoomCleaningLog {
  id: string;
  roomId: string;
  status: 'NEEDS_CLEANING' | 'IN_PROGRESS' | 'CLEANED' | 'OUT_OF_ORDER' | string;
  requestedBy?: string | null;
  cleanedBy?: string | null;
  notes?: string | null;
  requestedAt: string;
  cleanedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  blockId: string;
  block: RoomBlockInfo;
  floor: number;
  roomNumber: string;
  capacity: number;
  roomType?: string | null;
  status: RoomStatusType;
  beds: RoomBed[];
  maintenances?: RoomMaintenance[];
  inventories?: RoomInventory[];
  occupancyHistory?: RoomOccupancyHistory[];
  cleaningLogs?: RoomCleaningLog[];
}

export interface BlockSummary {
  id: string;
  name: string;
  genderPolicy: string;
  roomCount: number;
  totalCapacity: number;
  occupiedBeds: number;
  vacantBeds: number;
  outOfOrderRooms: number;
  occupancyRate: number;
}

export interface RoomStats {
  totalRooms: number;
  readyRooms: number;
  cleaningRooms: number;
  outOfOrderRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
}

export interface MaintenanceCreatePayload {
  type?: 'GENERAL' | 'ROOM_INVENTORY';
  roomInventoryId?: string;
  inventoryStatus?: RoomInventoryStatus;
  title?: string;
  description: string;
  priority: string;
  category?: string;
  location?: string;
}

const api = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/rooms`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export const roomApi = {
  getRooms: async (params?: { blockId?: string; floor?: number; status?: string; search?: string }): Promise<Room[]> => {
    const response = await api.get<{ success: boolean; data: Room[] }>('/', { params });
    return response.data.data;
  },

  getBlocks: async (): Promise<BlockSummary[]> => {
    const response = await api.get<{ success: boolean; data: BlockSummary[] }>('/blocks');
    return response.data.data;
  },

  getRoomById: async (roomId: string): Promise<Room> => {
    const response = await api.get<{ success: boolean; data: Room }>(`/${roomId}`);
    return response.data.data;
  },

  getRoomStats: async (): Promise<RoomStats> => {
    const response = await api.get<{ success: boolean; data: RoomStats }>('/stats');
    return response.data.data;
  },

  updateRoomStatus: async (roomId: string, status: RoomStatusType): Promise<Room> => {
    const response = await api.patch<{ success: boolean; data: Room; message: string }>(`/${roomId}/status`, { status });
    return response.data.data;
  },

  createRoom: async (payload: { blockId: string; floor: number; roomNumber: string; capacity?: number; roomType?: string }): Promise<Room> => {
    const response = await api.post<{ success: boolean; data: Room; message: string }>('/', payload);
    return response.data.data;
  },

  createBlock: async (payload: { name: string; genderPolicy: string }): Promise<BlockSummary> => {
    const response = await api.post<{ success: boolean; data: BlockSummary; message: string }>('/blocks', payload);
    return response.data.data;
  },

  createMaintenance: async (roomId: string, payload: MaintenanceCreatePayload): Promise<RoomMaintenance> => {
    const response = await api.post<{ success: boolean; data: RoomMaintenance; message: string }>(`/${roomId}/maintenance`, payload);
    return response.data.data;
  },

  updateMaintenance: async (maintenanceId: string, payload: { title?: string; description?: string; priority?: string; status?: string; assignedTo?: string | null; category?: string | null; location?: string | null; resolutionNote?: string | null }): Promise<RoomMaintenance> => {
    const response = await api.patch<{ success: boolean; data: RoomMaintenance; message: string }>(`/maintenance/${maintenanceId}`, payload);
    return response.data.data;
  },

  createCleaningLog: async (roomId: string, payload: { requestedBy?: string; cleanedBy?: string; notes?: string; status?: string }): Promise<Room> => {
    const response = await api.post<{ success: boolean; data: Room; message: string }>(`/${roomId}/cleaning`, payload);
    return response.data.data;
  },

  updateCleaningLog: async (cleaningId: string, payload: { status?: string; cleanedBy?: string; notes?: string; requestedBy?: string }): Promise<Room> => {
    const response = await api.patch<{ success: boolean; data: Room; message: string }>(`/cleaning/${cleaningId}`, payload);
    return response.data.data;
  },

  deleteCleaningLog: async (cleaningId: string): Promise<Room> => {
    const response = await api.delete<{ success: boolean; data: Room; message: string }>(`/cleaning/${cleaningId}`);
    return response.data.data;
  },

  updateRoom: async (roomId: string, payload: { roomNumber?: string; floor?: number; capacity?: number; roomType?: string; status?: RoomStatusType }): Promise<Room> => {
    const response = await api.put<{ success: boolean; data: Room; message: string }>(`/${roomId}`, payload);
    return response.data.data;
  },

  deleteRoom: async (roomId: string): Promise<void> => {
    await api.delete(`/${roomId}`);
  },

  createRoomInventory: async (roomId: string, payload: { itemName: string; brand?: string; serialNo?: string; quantity?: number; status?: RoomInventoryStatus; stockItemId?: string }): Promise<RoomInventory> => {
    const response = await api.post<{ success: boolean; data: RoomInventory; message: string }>(`/${roomId}/inventories`, payload);
    return response.data.data;
  },

  exportOccupancyExcel: async (filter?: string, startDate?: string, endDate?: string): Promise<void> => {
    try {
      const response = await api.get<Blob>('/occupancy/export.xlsx', {
        params: { filter, startDate, endDate },
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] || '';
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'konaklayanlar-listesi.xlsx';
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      let msg = 'Excel dosyası oluşturulamadı.';
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || msg;
        } catch (_) {}
      } else if (error.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error.message) {
        msg = error.message;
      }
      throw new Error(msg);
    }
  },

  exportRoomInventoryExcel: async (filter?: string): Promise<void> => {
    try {
      const response = await api.get<Blob>('/inventories/export.xlsx', {
        params: { filter },
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] || '';
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'oda-demirbas-zimmetleri.xlsx';
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      let msg = 'Excel dosyası oluşturulamadı.';
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || msg;
        } catch (_) {}
      } else if (error.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error.message) {
        msg = error.message;
      }
      throw new Error(msg);
    }
  },
};
