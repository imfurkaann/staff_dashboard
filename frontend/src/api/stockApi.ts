import { appConfig } from '../config/appConfig';
const API_BASE_URL = appConfig.apiBaseUrl;

export interface StockItem {
  id: string;
  itemName: string;
  totalStock: number;
  usedStock: number;
  usedInRooms: number;
  createdAt: string;
  updatedAt: string;
}

export const stockApi = {
  getStockItems: async (): Promise<StockItem[]> => {
    const res = await fetch(`${API_BASE_URL}/stock`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Stok kalemleri alınamadı.');
    return data.data;
  },

  createStockItem: async (payload: { itemName: string; totalStock: number }): Promise<StockItem> => {
    const res = await fetch(`${API_BASE_URL}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Stok kalemi oluşturulamadı.');
    return data.data;
  },

  updateStockQuantity: async (id: string, newTotal: number): Promise<StockItem> => {
    const res = await fetch(`${API_BASE_URL}/stock/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newTotal }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Stok miktarı güncellenemedi.');
    return data.data;
  },

  deleteStockItem: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/stock/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Stok kalemi silinemedi.');
  },
};
