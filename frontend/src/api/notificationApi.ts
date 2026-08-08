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

export const notificationApi = {
  getSentNotifications: async (): Promise<SentNotification[]> => {
    const res = await fetch(`${API_BASE_URL}/notifications`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Gönderilen bildirimler alınamadı.');
    return data.data;
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
