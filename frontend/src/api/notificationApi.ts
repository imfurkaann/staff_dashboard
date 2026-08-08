import { appConfig } from '../config/appConfig';
const API_BASE_URL = appConfig.apiBaseUrl;

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  targetType: 'ALL' | 'SPECIFIC_USERS' | 'BLOCK' | 'DEPARTMENT';
  targetValue?: string | null;
  createdAt: string;
  senderName?: string;
  totalRecipients: number;
  readCount: number;
  readRatio: number;
  recipientNames?: string;
}

export interface SendNotificationPayload {
  title: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  targetType: 'ALL' | 'SPECIFIC_USERS' | 'BLOCK' | 'DEPARTMENT';
  targetValue?: string;
}

export interface NotificationPage {
  items: SentNotification[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export const notificationApi = {
  getSentNotifications: async (page = 1): Promise<NotificationPage> => {
    const res = await fetch(`${API_BASE_URL}/notifications?page=${page}&pageSize=25`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gönderilen bildirimler alınamadı.');
    return { items: data.data, pagination: data.pagination };
  },

  sendNotification: async (payload: SendNotificationPayload) => {
    const res = await fetch(`${API_BASE_URL}/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bildirim gönderilemedi.');
    return data;
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
