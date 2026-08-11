import axios from 'axios';
import { appConfig } from '../config/appConfig';

function maintenanceError(error: unknown, fallback: string): Error {
  const candidate = error as { response?: { data?: { message?: string } }; message?: string };
  return new Error(candidate.response?.data?.message || candidate.message || fallback);
}

export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MaintenanceType = 'GENERAL' | 'ROOM_INVENTORY';
export type InventoryFaultStatus = 'MAINTENANCE_REQUIRED' | 'DAMAGED' | 'LOST' | 'IN_SERVICE' | 'REPLACEMENT_REQUIRED';

export interface MaintenanceLog {
  id: string;
  roomId: string;
  type: MaintenanceType;
  roomInventoryId?: string | null;
  inventoryStatus?: InventoryFaultStatus | null;
  inventoryItemNameSnapshot?: string | null;
  inventoryBrandSnapshot?: string | null;
  inventorySerialNoSnapshot?: string | null;
  inventoryAssetTagSnapshot?: string | null;
  inventoryQuantitySnapshot?: number | null;
  roomInventory?: { id: string; assetTag?: string | null; itemName: string; brand?: string | null; serialNo?: string | null; quantity: number; status: string; returnedAt?: string | null } | null;
  room?: {
    id: string;
    roomNumber: string;
    floor: number;
    block: {
      id: string;
      name: string;
    };
  };
  category?: string | null;
  location?: string | null;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedBy: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  serviceProvider?: string | null;
  serviceReference?: string | null;
  laborCost?: number;
  partsCost?: number;
  warrantyCovered: boolean;
  sentToServiceAt?: string | null;
  returnedFromServiceAt?: string | null;
  events?: Array<{ id: string; action: string; fromStatus?: MaintenanceStatus | null; toStatus?: MaintenanceStatus | null; inventoryStatus?: string | null; notes?: string | null; serviceProvider?: string | null; serviceReference?: string | null; laborCost?: number | null; partsCost?: number | null; warrantyCovered?: boolean | null; performedBy: string; createdAt: string }>;
}

export interface MaintenanceQueryFilters {
  status?: MaintenanceStatus | 'ALL';
  priority?: MaintenancePriority | 'ALL';
  category?: string | 'ALL';
  blockId?: string;
  search?: string;
  dateStart?: string;
  dateEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface MaintenanceSummaryStats {
  totalCount: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
  urgentCount: number;
}

export interface MaintenancePagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MaintenanceListResponse {
  items: MaintenanceLog[];
  summary: MaintenanceSummaryStats;
  pagination: MaintenancePagination;
}

export interface CreateMaintenanceDTO {
  roomId?: string;
  type?: MaintenanceType;
  roomInventoryId?: string;
  inventoryStatus?: InventoryFaultStatus;
  title?: string;
  description: string;
  priority?: MaintenancePriority;
  category?: string;
  location?: string;
  assignedTo?: string;
}

export interface UpdateMaintenanceDTO {
  title?: string;
  description?: string;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  category?: string;
  location?: string | null;
  assignedTo?: string | null;
  resolutionNote?: string | null;
  inventoryStatus?: string;
  serviceProvider?: string | null;
  serviceReference?: string | null;
  laborCost?: number;
  partsCost?: number;
  warrantyCovered?: boolean;
  sentToServiceAt?: string | null;
  returnedFromServiceAt?: string | null;
}

export const maintenanceApi = {
  getMaintenances: async (filters: MaintenanceQueryFilters = {}): Promise<MaintenanceListResponse> => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
    if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
    if (filters.blockId) params.append('blockId', filters.blockId);
    if (filters.search) params.append('search', filters.search);
    if (filters.dateStart) params.append('dateStart', filters.dateStart);
    if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize));

    try {
      const response = await axios.get<{ success: boolean; data: MaintenanceListResponse }>(
      `${appConfig.apiBaseUrl}/maintenance`,
      {
        params,
        withCredentials: true,
      }
    );
      return response.data.data;
    } catch (error) {
      throw maintenanceError(error, 'Arıza kayıtları alınamadı.');
    }
  },

  createMaintenance: async (dto: CreateMaintenanceDTO, requestKey?: string): Promise<MaintenanceLog> => {
    try {
      const response = await axios.post<{ success: boolean; data: MaintenanceLog }>(
      `${appConfig.apiBaseUrl}/maintenance`,
      dto,
      {
        withCredentials: true,
        headers: requestKey ? { 'X-Idempotency-Key': requestKey } : undefined,
      }
    );
      return response.data.data;
    } catch (error) {
      throw maintenanceError(error, 'Arıza kaydı oluşturulamadı.');
    }
  },

  updateMaintenance: async (id: string, dto: UpdateMaintenanceDTO): Promise<MaintenanceLog> => {
    try {
      const response = await axios.patch<{ success: boolean; data: MaintenanceLog }>(
      `${appConfig.apiBaseUrl}/maintenance/${id}`,
      dto,
      {
        withCredentials: true,
      }
    );
      return response.data.data;
    } catch (error) {
      throw maintenanceError(error, 'Arıza kaydı güncellenemedi.');
    }
  },

  exportExcel: async (filters: MaintenanceQueryFilters = {}): Promise<void> => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
    if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
    if (filters.blockId) params.append('blockId', filters.blockId);
    if (filters.search) params.append('search', filters.search);
    if (filters.dateStart) params.append('dateStart', filters.dateStart);
    if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);

    try {
      const response = await axios.get<Blob>(
      `${appConfig.apiBaseUrl}/maintenance/export.xlsx`,
      {
        params,
        responseType: 'blob',
        withCredentials: true,
      }
    );

    const disposition = response.headers['content-disposition'] || '';
    const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'ariza-bakim-kayitlari.xlsx';
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      throw maintenanceError(error, 'Arıza raporu indirilemedi.');
    }
  },
};
