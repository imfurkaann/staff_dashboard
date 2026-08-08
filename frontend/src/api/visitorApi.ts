import axios from 'axios';
import { appConfig } from '../config/appConfig';

export interface Visitor {
  id: string;
  fullName: string;
  visitorCount: number;
  phone?: string | null;
  company?: string | null;
  hostEmployeeId?: string | null;
  hostEmployeeName?: string | null;
  hostRoomLabel?: string | null;
  purpose?: string | null;
  vehiclePlate?: string | null;
  entryTime: string;
  exitTime?: string | null;
  status: 'INSIDE' | 'EXITED';
  notes?: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; fullName: string } | null;
  updatedBy?: { id: string; fullName: string } | null;
  deletedBy?: { id: string; fullName: string } | null;
}

export interface CreateVisitorPayload {
  fullName: string;
  visitorCount?: number;
  phone?: string;
  company?: string;
  hostEmployeeId: string;
  purpose: string;
  vehiclePlate?: string;
  notes?: string;
}

export type UpdateVisitorPayload = Partial<CreateVisitorPayload>;

export interface VisitorQuery {
  search?: string;
  visitorName?: string;
  company?: string;
  hostName?: string;
  purpose?: string;
  phone?: string;
  vehiclePlate?: string;
  status?: 'ALL' | 'INSIDE' | 'EXITED' | 'DELETED' | 'WITH_DELETED';
  dateStart?: string;
  dateEnd?: string;
  hostEmployeeId?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'entryTime' | 'exitTime' | 'fullName' | 'company';
  sortOrder?: 'asc' | 'desc';
}

export interface VisitorListResult {
  items: Visitor[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { inside: number; exited: number; deleted?: number };
}

const api = axios.create({ baseURL: `${appConfig.apiBaseUrl}/visitors`, withCredentials: true });

function messageFrom(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.message === 'string') return error.response.data.message;
  return fallback;
}

async function extractBlobErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data) {
    const data = error.response.data;
    if (typeof data?.message === 'string') return data.message;
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (typeof parsed.message === 'string') return parsed.message;
      } catch {}
    }
  }
  return messageFrom(error, fallback);
}

export const visitorApi = {
  getVisitors: async (query: VisitorQuery = {}): Promise<VisitorListResult> => {
    const response = await api.get<{ success: boolean; data: Visitor[]; pagination: VisitorListResult['pagination']; summary: VisitorListResult['summary'] }>('/', { params: query });
    return { items: response.data.data, pagination: response.data.pagination, summary: response.data.summary };
  },
  getVisitorById: async (id: string): Promise<Visitor> => (await api.get<{ data: Visitor }>(`/${id}`)).data.data,
  createVisitor: async (payload: CreateVisitorPayload): Promise<Visitor> => {
    try { return (await api.post<{ data: Visitor }>('/', payload)).data.data; }
    catch (error) { throw new Error(messageFrom(error, 'Ziyaretçi kaydı eklenemedi.')); }
  },
  updateVisitor: async (id: string, payload: UpdateVisitorPayload): Promise<Visitor> => {
    try { return (await api.put<{ data: Visitor }>(`/${id}`, payload)).data.data; }
    catch (error) { throw new Error(messageFrom(error, 'Ziyaretçi bilgileri güncellenemedi.')); }
  },
  checkOutVisitor: async (id: string): Promise<Visitor> => {
    try { return (await api.patch<{ data: Visitor }>(`/${id}/checkout`)).data.data; }
    catch (error) { throw new Error(messageFrom(error, 'Ziyaretçi çıkışı kaydedilemedi.')); }
  },
  undoCheckOutVisitor: async (id: string): Promise<Visitor> => {
    try { return (await api.patch<{ data: Visitor }>(`/${id}/undo-checkout`)).data.data; }
    catch (error) { throw new Error(messageFrom(error, 'Çıkış işlemi geri alınamadı.')); }
  },
  restoreVisitor: async (id: string): Promise<Visitor> => {
    try { return (await api.patch<{ data: Visitor }>(`/${id}/restore`)).data.data; }
    catch (error) { throw new Error(messageFrom(error, 'Ziyaretçi kaydı geri yüklenemedi.')); }
  },
  deleteVisitor: async (id: string): Promise<void> => {
    try { await api.delete(`/${id}`); }
    catch (error) { throw new Error(messageFrom(error, 'Ziyaretçi kaydı silinemedi.')); }
  },
  exportExcel: async (query: VisitorQuery = {}): Promise<void> => {
    try {
      const response = await api.get<Blob>('/export.xlsx', { params: query, responseType: 'blob' });
      const disposition = response.headers['content-disposition'] || '';
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'ziyaretci-kayitlari.xlsx';
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const errMsg = await extractBlobErrorMessage(error, 'Excel dosyası oluşturulamadı.');
      throw new Error(errMsg);
    }
  },
};
