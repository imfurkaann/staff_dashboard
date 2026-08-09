import axios from 'axios';
import { appConfig } from '../config/appConfig';

export interface Bed {
  id: string;
  bedLabel: string;
  isOccupied: boolean;
  room: {
    id: string;
    roomNumber: string;
    floor: number;
    block: {
      id: string;
      name: string;
      genderPolicy: string;
    };
  };
}

export interface UserAccountInfo {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'HOUSING_MANAGER' | 'SECURITY' | 'STAFF';
  isActive: boolean;
}

export interface Employee {
  id: string;
  tcNo?: string;
  tcNoMasked?: string;
  registrationNo?: string;
  firstName: string;
  lastName: string;
  gender: string;
  department: string;
  title?: string;
  company?: string;
  phone?: string;
  isSmoker?: boolean;
  hasSnoring?: boolean;
  vehiclePlate?: string;
  ageGroup?: string;
  languageNationality?: string;
  emergencyContactName?: string;
  emergencyRelation?: string;
  emergencyContactPhone?: string;
  photoUrl?: string;
  shiftType?: string;
  status: 'PENDING_ASSIGNMENT' | 'RESIDENT' | 'ON_LEAVE' | 'CHECKED_OUT';
  createdAt: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  userId?: string | null;
  user?: UserAccountInfo | null;
  generatedAccountInfo?: { username: string; password: string };
  beds?: Bed[];
  inventories?: any[];
  disciplinaryNotes?: any[];
  occupancies?: any[];
}

export interface SystemUserPayload {
  createAccount?: boolean;
  username?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'HOUSING_MANAGER' | 'SECURITY' | 'STAFF';
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  gender: string;
  department: string;
  title?: string;
  company?: string;
  tcNo?: string;
  registrationNo?: string;
  phone?: string;
  isSmoker?: boolean;
  hasSnoring?: boolean;
  vehiclePlate?: string;
  ageGroup?: string;
  languageNationality?: string;
  emergencyContactName?: string;
  emergencyRelation?: string;
  emergencyContactPhone?: string;
  photoUrl?: string;
  shiftType?: string;
  bedId?: string;
  systemUser?: SystemUserPayload;
}

const api = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/employees`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const employeeApi = {
  getEmployees: async (
    search?: string, 
    status?: string, 
    department?: string, 
    gender?: string, 
    startDate?: string, 
    endDate?: string
  ): Promise<Employee[]> => {
    const response = await api.get<{ success: boolean; data: Employee[] }>('/', {
      params: { search, status, department, gender, startDate, endDate },
    });
    return response.data.data;
  },

  getEmployeeById: async (id: string): Promise<Employee | null> => {
    try {
      const response = await api.get<{ success: boolean; data: Employee }>(`/${id}`);
      return response.data.data || null;
    } catch (error) {
      return null;
    }
  },

  createEmployee: async (payload: CreateEmployeePayload): Promise<Employee> => {
    try {
      const response = await api.post<{ success: boolean; data: Employee }>('/', payload);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(error.message || 'Personel eklenirken sunucu hatası oluştu.');
    }
  },

  updateEmployee: async (id: string, payload: Partial<CreateEmployeePayload>): Promise<Employee> => {
    try {
      const response = await api.put<{ success: boolean; data: Employee }>(`/${id}`, payload);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(error.message || 'Personel güncellenirken sunucu hatası oluştu.');
    }
  },

  getAvailableBeds: async (gender?: string): Promise<Bed[]> => {
    const response = await api.get<{ success: boolean; data: Bed[] }>('/available-beds', {
      params: { gender },
    });
    return response.data.data;
  },

  addInventoryItem: async (employeeId: string, payload: { itemName: string; itemCode?: string; category?: string; serialNo?: string; photoUrl?: string; notes?: string; stockItemId?: string }) => {
    const response = await api.post<{ success: boolean; data: any }>(`/${employeeId}/inventories`, payload);
    return response.data.data;
  },

  updateInventoryItem: async (inventoryId: string, payload: { itemName?: string; serialNo?: string; notes?: string }) => {
    const response = await api.put<{ success: boolean; data: any }>(`/inventories/${inventoryId}`, payload);
    return response.data.data;
  },

  returnInventoryItem: async (inventoryId: string, payload?: { status?: string; notes?: string }) => {
    const response = await api.patch<{ success: boolean; data: any }>(`/inventories/${inventoryId}/return`, payload);
    return response.data.data;
  },

  deleteInventoryItem: async (inventoryId: string) => {
    const response = await api.delete<{ success: boolean }>(`/inventories/${inventoryId}`);
    return response.data;
  },

  addDisciplinaryNote: async (employeeId: string, payload: { title: string; content: string; reportedBy?: string }) => {
    const response = await api.post<{ success: boolean; data: any }>(`/${employeeId}/disciplinary-notes`, payload);
    return response.data.data;
  },

  updateDisciplinaryNote: async (noteId: string, payload: { title?: string; content?: string }) => {
    const response = await api.put<{ success: boolean; data: any }>(`/disciplinary-notes/${noteId}`, payload);
    return response.data.data;
  },

  deleteDisciplinaryNote: async (noteId: string) => {
    const response = await api.delete<{ success: boolean }>(`/disciplinary-notes/${noteId}`);
    return response.data;
  },

  deleteEmployee: async (id: string): Promise<boolean> => {
    await api.delete(`/${id}`);
    return true;
  },

  checkoutRoom: async (id: string): Promise<Employee> => {
    try {
      const response = await api.patch<{ success: boolean; data: Employee }>(`/${id}/checkout`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(error.message || 'Personel odadan çıkarılırken sunucu hatası oluştu.');
    }
  },

  exportExcel: async (search?: string, status?: string, department?: string, gender?: string, startDate?: string, endDate?: string): Promise<void> => {
    try {
      const response = await api.get<Blob>('/export.xlsx', {
        params: { search, status, department, gender, startDate, endDate },
        responseType: 'blob',
      });
      const disposition = response.headers['content-disposition'] || '';
      const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'personel-listesi.xlsx';
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      let msg = 'Excel dosyası oluşturulamadı.';
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || msg;
        } catch (_) {}
      } else if (error.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error.message) {
        msg = error.message;
      }
      throw new Error(msg);
    }
  },

  generateAccount: async (id: string): Promise<{ username: string; password: string; role: string }> => {
    try {
      const response = await api.post<{ success: boolean; data: { username: string; password: string; role: string } }>(`/${id}/generate-account`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(error.message || 'Hesap üretilirken hata oluştu.');
    }
  },
};
