import axios from 'axios';
import { appConfig } from '../config/appConfig';

export interface DashboardSummary {
  totalEmployees: number;
  pendingEmployees: number;
  residentEmployees: number;
  totalBeds: number;
  occupiedBeds: number;
  openMaintenance: number;
  blocks: Array<{ id: string; name: string; genderPolicy: string; totalBeds: number; occupiedBeds: number }>;
}

export const dashboardApi = {
  async getSummary(): Promise<DashboardSummary> {
    const response = await axios.get<{ success: boolean; data: DashboardSummary }>(`${appConfig.apiBaseUrl}/dashboard`, { withCredentials: true });
    return response.data.data;
  },
};
