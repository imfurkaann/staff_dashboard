import { appConfig } from '../config/appConfig';
import { generateUUID } from '../utils/cryptoHelpers';
const API_BASE_URL = appConfig.apiBaseUrl;

export interface RecipientInfo {
  fullName: string;
  username: string;
}

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  targetType: 'ALL' | 'SPECIFIC_USERS' | 'BLOCK' | 'DEPARTMENT' | 'GENDER';
  targetValue?: string | null;
  createdAt: string;
  senderName?: string;
  totalRecipients: number;
  recipientNames?: string;
  recipients?: RecipientInfo[];
}

export interface SendNotificationPayload {
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  targetType: 'ALL' | 'SPECIFIC_USERS' | 'BLOCK' | 'DEPARTMENT' | 'GENDER';
  targetValue?: string;
}

export interface NotificationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  priority?: string;
  targetType?: string;
  sender?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface NotificationSummaryStats {
  totalCount: number;
  normalCount: number;
  importantCount: number;
  urgentCount: number;
}

export interface NotificationPage {
  items: SentNotification[];
  summary: NotificationSummaryStats;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export const notificationApi = {
  getSentNotifications: async (query: NotificationQuery = {}): Promise<NotificationPage> => {
    const params = new URLSearchParams();
    if (query.page) params.append('page', String(query.page));
    if (query.pageSize) params.append('pageSize', String(query.pageSize));
    if (query.search) params.append('search', query.search);
    if (query.priority) params.append('priority', query.priority);
    if (query.targetType) params.append('targetType', query.targetType);
    if (query.sender) params.append('sender', query.sender);
    if (query.dateStart) params.append('dateStart', query.dateStart);
    if (query.dateEnd) params.append('dateEnd', query.dateEnd);

    const res = await fetch(`${API_BASE_URL}/notifications?${params.toString()}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gönderilen bildirimler alınamadı.');
    return { items: data.data, summary: data.summary, pagination: data.pagination };
  },

  sendNotification: async (payload: SendNotificationPayload) => {
    const requestKey = generateUUID();
    const res = await fetch(`${API_BASE_URL}/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bildirim gönderilemedi.');
    return data;
  },

  getNotificationDetail: async (id: string): Promise<SentNotification> => {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Duyuru ayrıntısı alınamadı.');
    return data.data;
  },

  deleteNotification: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bildirim silinemedi.');
    return data;
  },
};
