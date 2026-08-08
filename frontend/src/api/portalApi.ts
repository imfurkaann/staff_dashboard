import { appConfig } from '../config/appConfig';
const API_BASE_URL = appConfig.apiBaseUrl;

export interface StaffPortalData {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    department: string;
    title?: string | null;
    phone?: string | null;
    tcNoMasked: string;
    photoUrl?: string | null;
    shiftType?: string | null;
    status: string;
  };
  roomInfo: {
    blockName: string;
    genderPolicy: string;
    floor: number;
    roomNumber: string;
    bedLabel: string;
    roomStatus: string;
    capacity: number;
  } | null;
  roommates: Array<{
    id: string;
    fullName: string;
    department: string;
    title: string | null;
    shiftType: string | null;
    bedLabel: string;
  }>;
  inventories: Array<{
    id: string;
    itemName: string;
    itemCode?: string | null;
    category: string;
    serialNo?: string | null;
    status: string;
    assignedDate: string;
  }>;
  notifications: {
    unreadCount: number;
    items: Array<{
      recipientId: string;
      notificationId: string;
      title: string;
      message: string;
      priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
      createdAt: string;
      senderName: string;
      isRead: boolean;
      readAt?: string | null;
    }>;
  };
}

export const portalApi = {
  getPushPublicKey: async (): Promise<string> => {
    const res = await fetch(`${API_BASE_URL}/portal/push/public-key`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Push yapılandırması alınamadı.');
    return data.data.publicKey;
  },

  subscribePush: async (subscription: PushSubscription) => {
    const res = await fetch(`${API_BASE_URL}/portal/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Telefon bildirimi etkinleştirilemedi.');
    return data;
  },

  unsubscribePush: async (endpoint: string) => {
    const res = await fetch(`${API_BASE_URL}/portal/push/subscribe`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Telefon bildirimi kapatılamadı.');
    return data;
  },

  testPush: async () => {
    const res = await fetch(`${API_BASE_URL}/portal/push/test`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Test bildirimi gönderilemedi.');
    return data.data as { sent: number; failed: number; disabled: boolean };
  },
  getPortalData: async (): Promise<StaffPortalData> => {
    const res = await fetch(`${API_BASE_URL}/portal/me`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Portal verileri alınamadı.');
    return data.data;
  },

  markNotificationRead: async (recipientId: string) => {
    const res = await fetch(`${API_BASE_URL}/portal/notifications/${recipientId}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bildirim okundu olarak işaretlenemedi.');
    return data;
  },

  markAllNotificationsRead: async () => {
    const res = await fetch(`${API_BASE_URL}/portal/notifications/read-all`, {
      method: 'PATCH',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bildirimler işaretlenemedi.');
    return data;
  },
};
