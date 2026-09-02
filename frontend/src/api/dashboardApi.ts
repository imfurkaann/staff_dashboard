import axios from 'axios';
import { appConfig } from '../config/appConfig';

export interface DashboardSummary {
  generatedAt: string;
  rooms: { total: number; ready: number; needsCleaning: number; outOfOrder: number; attention: Array<{ id: string; roomLabel: string; status: string }> };
  occupancy: { totalBeds: number; occupiedBeds: number; availableBeds: number; checkInsToday: number; checkOutsToday: number };
  blocks: Array<{ id: string; name: string; genderPolicy: string; roomCount: number; totalBeds: number; occupiedBeds: number; attentionRooms: number }>;
  activity: Array<{ date: string; occupancy: number; maintenance: number; visitors: number; tickets: number }>;
  employees: null | { total: number; resident: number; pending: number; onLeave: number; checkedOut: number; departments: Array<{ name: string; count: number }> };
  maintenance: null | { open: number; inProgress: number; resolved: number; closed: number; urgent: number; resolvedThisMonth: number; recent: Array<{ id: string; title: string; priority: string; status: string; createdAt: string; roomLabel: string }> };
  visitors: null | { inside: number; todayEntries: number; overdue: number };
  tickets: null | { open: number; inProgress: number; resolved: number; rejected: number; recent: Array<{ id: string; ticketNo: string; subject: string; category: string; status: string; createdAt: string }> };
  sharedAssets: null | { total: number; available: number; loaned: number; maintenance: number; usesToday: number; overdue: number };
  cleaning: null | { waiting: number; inProgress: number; cleanedToday: number; tasks: Array<{ id: string; roomLabel: string; status: string; requestedAt: string; cleanedBy?: string | null }> };
  notifications: null | { recent: Array<{ id: string; title: string; priority: string; targetType: string; createdAt: string }> };
  users: null | { active: number };
}

export const dashboardApi = {
  async getSummary(): Promise<DashboardSummary> {
    const response = await axios.get<{ success: boolean; data: DashboardSummary }>(`${appConfig.apiBaseUrl}/dashboard`, { withCredentials: true });
    return response.data.data;
  },
};
