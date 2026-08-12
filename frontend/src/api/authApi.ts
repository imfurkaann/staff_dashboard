import axios from 'axios';
import { AxiosError } from 'axios';
import { appConfig } from '../config/appConfig';
import { AppRole } from '../security/accessControl';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: AppRole;
  mustChangePassword: boolean;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
  };
}

const api = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/auth`,
  withCredentials: true, // Send HTTP-Only Cookies automatically
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authApi = {
  login: async (usernameOrEmail: string, password: string): Promise<LoginResponse> => {
    try {
      const response = await api.post<LoginResponse>('/login', { usernameOrEmail, password });
      return response.data;
    } catch (error: unknown) {
      const apiError = error as AxiosError<LoginResponse>;
      if (apiError.response?.data) {
        return apiError.response.data;
      }
      return {
        success: false,
        message: 'Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.',
      };
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/logout');
    } catch (e) {
      console.warn('Logout API failed, clearing local state');
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await api.get('/me');
      return response.data.data.user;
    } catch (e) {
      return null;
    }
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post<{ success: boolean; message: string }>('/change-password', { oldPassword, newPassword });
      return response.data;
    } catch (error: unknown) {
      const apiError = error as AxiosError<{ success: boolean; message: string }>;
      return apiError.response?.data || { success: false, message: 'Parola değiştirilemedi. Bağlantınızı kontrol edip tekrar deneyin.' };
    }
  },
};
