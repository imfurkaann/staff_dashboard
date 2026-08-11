import { appConfig } from '../config/appConfig';

export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

export interface SupportTicket {
  id: string;
  ticketNo: string;
  employeeId?: string | null;
  creatorName: string;
  roomNumber?: string | null;
  blockName?: string | null;
  category: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  adminNote?: string | null;
  resolvedAt?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    registrationNo?: string | null;
    department?: string | null;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
    role: string;
  } | null;
}

export interface SupportTicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  rejected: number;
}

export const ticketApi = {
  async getTickets(filters?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<{ tickets: SupportTicket[]; stats: SupportTicketStats }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets${query}`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talepler alınamadı.');
    return json.data;
  },

  async getMyTickets(): Promise<SupportTicket[]> {
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets/my-tickets`, { credentials: 'include' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talepleriniz alınamadı.');
    return json.data || [];
  },

  async createTicket(payload: {
    employeeId?: string;
    creatorName?: string;
    roomNumber?: string;
    blockName?: string;
    category: string;
    subject: string;
    description: string;
  }): Promise<SupportTicket> {
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talep oluşturulamadı.');
    return json.data;
  },

  async updateTicketStatus(
    id: string,
    payload: { status: SupportTicketStatus; adminNote?: string }
  ): Promise<SupportTicket> {
    const res = await fetch(`${appConfig.apiBaseUrl}/tickets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Talep durumu güncellenemedi.');
    return json.data;
  },
};
