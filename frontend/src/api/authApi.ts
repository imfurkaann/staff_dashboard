import axios from 'axios';
import { appConfig } from '../config/appConfig';
import { AppRole } from '../security/accessControl';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: AppRole;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: User;
    token: string;
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
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
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
};
